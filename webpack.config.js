var webpack = require('webpack');

module.exports = {
  entry: ['./src/main.js'],
  output: {
    path: __dirname + '/dist/',
    filename: 'uvis.js'
  },
  devtool:'source-map',
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel',
        query: {
          presets: ['es2015']
        }
      }
    ]
  },
  debug:true
}
