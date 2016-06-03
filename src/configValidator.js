export default function configValidator(userConfig) {
  if(typeof userConfig.resourceProvider !== 'function')
    throw new Error("You must provide a fileProvider function");

  const resourceProvider = userConfig.resourceProvider;

  if(typeof userConfig.initialVismfile !== 'string' || userConfig.initialVismfile === '')
    throw new Error("You must provide an initialVismfile as a string.");

  const initialVismfile = userConfig.initialVismfile;

  if(typeof userConfig.selector !== 'string')
    throw new Error("You must provide an application selector");

  const selector = document.getElementById(userConfig.selector);
  if(selector === null)
    throw new Error("The app selector is not valid");

  return {
    resourceProvider: resourceProvider,
    initialVismfile: initialVismfile,
    selector: selector
  };

}
