export default function configValidator(userConfig) {
  if(typeof userConfig.fileProvider !== 'function')
    throw new Error("You must provide a fileProvider function");

  const fileProvider = userConfig.fileProvider;

  if(typeof userConfig.databaseConnector !== 'function')
    throw new Error("You must provide a databaseConnector function");

  const databaseConnector = userConfig.databaseConnector;

  if(typeof userConfig.odatajs !== 'object')
    throw new Error("an odatajs library must be provided");

  if(typeof userConfig.initialVismfile !== 'string' || userConfig.initialVismfile === '')
    throw new Error("You must provide an initialVismfile as a string.");

  const initialVismfile = userConfig.initialVismfile;

  if(typeof userConfig.selector !== 'string')
    throw new Error("You must provide an application selector");

  const selector = document.getElementById(userConfig.selector);
  if(selector === null)
    throw new Error("The app selector is not valid");

  return {
    fileProvider: fileProvider,
    databaseConnector: databaseConnector,
    initialVismfile: initialVismfile,
    selector: selector
  };

}
