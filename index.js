require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dns = require('node:dns');

mongoose.connect(process.env['MONGO_URI']);

const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true, unique: true },
  short_url: { type: Number, required: true, unique: true },
})

const UrlModel = mongoose.model('UrlModel', urlSchema);

// Basic Configuration
const port = process.env.PORT || 3000;

//Enables Cross-Origin Resource Sharing.
app.use(cors());

// Parse incoming request bodies in JSON and URL-encoded formats.
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//Serves static files from the public directory.
app.use('/public', express.static(`${process.cwd()}/public`));

//The root route serves the HTML file.
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// API endpoint to create a short URL
const util = require('util');
const dnsLookup = util.promisify(dns.lookup);

// API endpoint to create a short URL
app.post('/api/shorturl', async (req, res) => {
  let originalUrl = req.body.url;

  try {
    // Check if the URL has a protocol; if not, add 'http://'
    if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://')) {
      originalUrl = 'http://' + originalUrl;
    }
    const urlObject = new URL(originalUrl);

    // Perform DNS lookup synchronously
    const { address } = await dnsLookup(urlObject.host);

    // Domain doesn't exist
    if (!address) {
      return res.json({ error: "invalid url, address doesn't exist" });
    }

    // Valid URL, proceed to create short URL
    let original_url = urlObject.href;
    let short_url;

    //Check if the URL is already in the databse
    let foundUrl = await UrlModel.findOne({ original_url })
    if (foundUrl) {
      res.json ({
        original_url: foundUrl.original_url,
        short_url: foundUrl.short_url,
      })      
    } else {
      // Create short URL
        let latestURL = await UrlModel.find({})
          .sort({ short_url: -1 })
          .limit(1);

        if (latestURL.length > 0) {
          short_url = latestURL[0].short_url + 1;
        } else {
          short_url = 1;
        }

        // Create an object containing the URLs
        let resObj = {
          original_url: original_url,
          short_url: short_url,
        };

        // Save URL to the database and return the result
        let newUrl = new UrlModel(resObj);
        await newUrl.save();
        res.json(resObj);
      } 
  } catch (error) {
    console.error('Error creating short URL:', error);
    res.json({ error: 'invalid url' });
  }
});

app.get('/api/shorturl/:short_url', async (req, res) => {
  let shortUrl = req.params.short_url;
  // Find the corresponding original URL
  let url = await UrlModel.findOne({
    short_url: shortUrl
  });
  // If the URL is not found, return an error
  if (url) {
    res.redirect(url.original_url);
  } else {
    res.json({ error: 'invalid url' });
  }

});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
