export default function () {
  // Check that the application is executed within a browser
  if(!window)
    throw new Error("This application must be executed in a browser environment");

  // Check that the browser supports promises
  if(!window.Promise)
    throw new Error("Your browser does not provide support for Promises. Try to use a recent version of Google Chrome instead.");

  if(!document)
    throw new Error("document is missing");
}
