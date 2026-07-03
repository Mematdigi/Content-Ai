const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { searchImage } = require('../services/imageService');

async function test() {
  console.log('Unsplash Key:', process.env.UNSPLASH_ACCESS_KEY);
  try {
    const img = await searchImage('niacinamide');
    console.log('Search Result:', img);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
