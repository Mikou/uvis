let resourceProvider = null,
    placeholder      = null,
    mode             = null,
    visfileName      = null,
    vismfileName     = null
;

function setVisfileName (filename) {
  if(typeof filename !== 'string')
    throw new Error('The file name must be a string');
  visfileName = filename;
}

function getVisfileName () {
  return visfileName;
}

function setVismfileName (filename) {
  if(typeof filename !== 'string')
    throw new Error('The file name must be a string');
  vismfileName = filename;
}

function getVismfileName () {
  return vismfileName;
}

function openVismfile () {
  return resourceProvider('vismfile', { filename: vismfileName, method:'GET' });
}

function openVisfile () {
  return resourceProvider('visfile', { filename: visfileName, method:'GET' });
}

function getResourceProvider () {
  return resourceProvider;
}

function setResourceProvider (fn) {
  if(typeof fn !== 'function')
    throw new Error('The resourceProvider must be a function');
  resourceProvider = fn;
}

function setMode (name) {
  if(typeof name !== 'string')
    throw new Error('The mode name must be a string');
  mode = name;
}

function getMode() {
  return mode;
}

function setPlaceholder (domElement) {
  if(typeof domElement !== 'object')
    throw new Error('The placeholder must be a DOM element');
  placeholder = domElement;
}

function getPlaceholder () {
  return placeholder;
}

export default {
  setResourceProvider: setResourceProvider,
  getResourceProvider: getResourceProvider,
  setPlaceholder: setPlaceholder,
  getPlaceholder: getPlaceholder,
  setMode: setMode,
  getMode: getMode,
  setVisfileName: setVisfileName,
  getVisfileName: getVisfileName,
  setVismfileName: setVismfileName,
  getVismfileName: getVismfileName,
  openVismfile: openVismfile,
  openVisfile: openVisfile
}
