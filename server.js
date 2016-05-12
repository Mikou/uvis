'use strict';

const express = require('express');

// Constants
const PORT = 3002;

// App
const app = express();

app.get('/uvis-latest.js', function (req, res) {
  res.sendFile(__dirname + '/public/uvis-latest.js');
});

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT);
console.log('Running on http://localhost:' + PORT);
