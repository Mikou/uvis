export default function () {
  // Check that the application is executed within a browser
  if(!window)
    throw new Error("This application must be executed in a browser environment");

  // Check that the browser supports promises
  if(!window.Promise)
    throw new Error("Your browser does not provide support for Promises. Try to use a recent version of Google Chrome instead.");

  if(!document)
    throw new Error("document is missing");

  Object.defineProperty(Array.prototype, 'prepend', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function(prefix) {
      if(typeof prefix !== 'string')
        throw new Error("the prepended value must be a string");

      for(var i=0, len=this.length; i<len; i++) {
        this[i] = prefix + this[i];
      }
      return this;
    }
  });

  Object.defineProperty(Array.prototype, 'union', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: function(b) {
      var a = this.concat(b);
      for(var i=0; i<a.length; ++i) {
        for(var j=i+1; j<a.length; ++j) {
          if(a[i] === a[j])
            a.splice(j--, 1);
        }
      }
      return a;
    }
  });
}
