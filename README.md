# Kernel

The kernel is an ``abstract`` JavaScript application that can be executed only 
in the context of a consumer application. It cannot be used as is.

The project is written following the ECMAScript 2015 specification of
JavaScript. It is transformed and a bundle is created thanks to webpack. 
It is distributed as a node package as an npm package.

The project can be installed with:

  npm install

A new bundle of the kernel can then be produced with the command:

  webpack

In order to run a local server, webpack-dev-server can be used. The following
command will make the server available on the localhost on port 3002:

  webpack-dev-server --port 3002 --content-base dist --inline
