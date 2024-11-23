const express = require('express');
const pool = require('./db');
const app = express();
app.use(express.json());
let recommendedItems = [];
let searchHistory = [];
let textBlocks1;
app.post('/api/search', async (req, res) => {
  const {query: currentSearched} = req.body;
  try {
  await pool.query('INSERT INTO username (search) VALUES (?)', [currentSearched]);
  const results = await pool.query('SELECT search FROM username WHERE email = exampleemail');
  searchHistory = results.rows.map(row => row.search);
  } catch(error){
    console.error('Error inserting searched into database', error);
  }
  res.json({success: true});
});
app.post('/api/pageText', async (req, res) => {
  const {query: textBlocks} = req.body;
  textBlocks1 = textBlocks;
  try {
    const [existingPages] = await pool('SELECT * FROM pages WHERE name = "frontpage"');
    if(existingPages && existingPages.text !== null){
      await pool.query('UPDATE pages SET text WHERE name = "frontpage"', [textBlocks])
    } else {
      await pool.query('INSERT INTO pages (name, text) VALUES (?, ?) ON DUPLICATE KEY UPDATE (text) = VALUES(text)', [textBlocks]);
    }
  } catch(error){
    console.error('Error inserting into pages database');
  }
  res.json({success: true})
});
const siteText = document.body.innerText;
const siteWords = siteText.replace(/[^a-zA-Z0-9\s]/g, '').split(' ').filter(word => word.length > 0);
function computeTF(word, textBlock){
  const wordCount = textBlock.split(' ').filter(w => w === word).length;
  const totalWords = textBlock.split(' ').length;
  return wordCount / totalWords;
}
function computeIDF(word, textBlocks1){
  const textBlocksWithWord = textBlocks1.filter(textBlock => textBlock.split(' ').includes(word)).length;
  return Math.log(textBlocks1.length / (textBlocksWithWord || 1));
}
function computeTFIDF(textBlocks1){
  const tfidf = [];
  const words = Array.from(new Set(textBlocks1.join(' ').split(' ')));
  textBlocks1.forEach(textBlock => {
    const textBlockTFIDF = {};
    words.forEach(word => {
      const tf = computeTF(word, textBlock);
      const idf = computeIDF(word, textBlocks1);
      textBlockTFIDF[word] = tf * idf;
    });
    tfidf.push(textBlockTFIDF);
  });
  return tfidf;
}
function cosineSimilarity(vecA, vecB){
  const dotproduct = Object.keys(vecA).reduce((sum, key) => sum + vecA[key] * (vecB[key] || 0), 0);
  const magnitudeA = Math.sqrt(Object.values(vecA).reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(Object.values(vecB).reduce((sum, val) => sum + val * val, 0));
  return dotproduct / (magnitudeA * magnitudeB);
}
function recommendedProducts(searchHistory, textBlocks1){
  const allText = [...textBlocks1, ...searchHistory];
  const tfidf = computeTFIDF(allText);
  const textBlockVectors = tfidf.slice(0, textBlocks1.length);
  const queryVector = tfidf.slice(textBlocks1.length);
  const similarities = textBlockVectors.map((textBlockVec, blockIdx) => {return queryVector.map((queryVec, queryIdx) => ({query: searchHistory[queryIdx], text: textBlocks1[blockIdx], similarity: cosineSimilarity(queryVec, textBlockVec)}));}).flat();
  const maxSimilarityIndex = similarities.indexOf(Math.max(...similarities));
  const mostSimilarTextBlock = textBlocks[maxSimilarityIndex];
}
    recommendedItems = similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
    result = recommendedItems.map(item => {
      delete item.similarities;
      delete item.query;
      return item;
    });
    result = result.map(item => Object.values(item)[0]);
    recommendedItems = result;
    return recommendedItems;
}
app.get('/api/recommended', async (req, res) => {
  const placeholders = recommendedItems.map(() => '?').join(',');
  const query = `SELECT * FROM items WHERE description IN (${placeholders})`;
  const [results] = await pool.query(query, recommendedItems);
  recommendedItems = results;
  res.json({items: recommendedItems});
});
app.get('/api/search', async (req, res) => {
  const result = await pool.query("SELECT * FROM username ORDER BY created_at DESC LIMIT 1");
  const searched = result.rows[0].search;
  result = await pool.query('SELECT * FROM items WHERE description LIKE ?', [`%${searched}%`]);
  searched = result.rows;
  res.json({search: searched});
});
app.get('/api/electronics/trending', async (req, res) => {
  const result = await pool.query(`SELECT i.*, COUNT(s.item_id) AS total_sales FROM items i JOIN sales s ON i.id = s.item_id WHERE i.category = 'electronics' AND s.sale_date >= NOW() - INTERVAL '30 days' GROUP BY i.id HAVING COUNT(s.item_id) >= 100`);
  const items = results.rows;
  res.json({recommendedItems: items});
});
app.get('/api/clothing/trending', async (req, res) => {
  const result = await pool.query(`SELECT i.*, COUNT(s.item_id) AS total_sales FROM items i JOIN sales s ON i.id = s.item_id WHERE i.category = 'clothing' AND s.sale_date >= NOW() - INTERVAL '30 days' GROUP BY i.id HAVING COUNT(s.item_id) >= 100`);
  const items = result.rows;
  res.json({recommendedItems: items});
});
app.get('/api/jewelry/trending', async (req, res) => {
  const result = await pool.query(`SELECT i.*, COUNT(s.item_id) AS total_sales FROM items i JOIN sales s ON i.id = s.item_id WHERE i.category = 'jewelry' AND s.sale_date >= NOW() - INTERVAL '30 days' GROUP BY i.id HAVING COUNT(s.item_id) >= 100`);
  const items = result.rows;
  res.json({recommendedItems: items});
});
  
