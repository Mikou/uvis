let visfile, visfileName, vismfile, vismfileName;
let role;
let saveVismfile = null;
const $toolBox = document.createElement('div');
$toolBox.id = "toolBox";

function renderVismfile (filename, stream, role) {
  const $header = document.createElement('h1');
  const $filename = document.createElement('pre');
  const $textArea = document.createElement('textArea');
  if(role === 'endUser')
    $textArea.readOnly = true;

  $header.innerHTML = "VismFile";
  $filename.innerHTML = 'filename: '+ filename;
  $textArea.value = stream;

  $toolBox.appendChild($header);
  $toolBox.appendChild($filename);
  $toolBox.appendChild($textArea);

  /*if(role === 'developer') {
    const $save = document.createElement('input');
    $save.type = "button";
    $save.value = "save " + filename;
    $save.addEventListener('click', function () {
      saveVismfile(filename, $textArea.value);
    });
    $toolBox.appendChild(document.createElement('br'));
    $toolBox.appendChild($save);
  } else {
    const $note = document.createElement('div');
    $note.className = "note";
    $note.innerHTML = "You do not have the permission to save this file";
    $toolBox.appendChild($note);
  }*/
}

function renderVisfile (filename, stream, role) {
  const $header = document.createElement('h1');
  const $filename = document.createElement('pre');
  const $textArea = document.createElement('textArea');
  if(role === 'endUser')
    $textArea.readOnly = true;

  $header.innerHTML = "VisFile";
  $filename.innerHTML = 'filename: '+ filename;
  $textArea.value = stream;

  $toolBox.appendChild($header);
  $toolBox.appendChild($filename);
  $toolBox.appendChild($textArea);

  if(role === 'designer') {
    const $save = document.createElement('input');
    $save.type = "button";
    $save.value = "save " + filename;
    $save.addEventListener('click', function () {
      saveVisfile(filename, $textArea.value);
    });
    $toolBox.appendChild(document.createElement('br'));
    $toolBox.appendChild($save);
  } else {
    const $note = document.createElement('div');
    $note.className = "note";
    $note.innerHTML = "You do not have the permission to save this file";
    $toolBox.appendChild($note);
  }
}

function create (selector) {
  $toolBox.innerHTML = '<h1>ToolBox</h1>';
  selector.appendChild($toolBox);
}

function setSaveVismfileMethod (fn) {
  saveVismfile = fn;
}

function setVisfile (filename, stream) {
  visfileName = filename;
  visfile = stream;
}

function setVismfile (filename, stream) {
  vismfileName = filename;
  vismfile = stream;
}

function setRole(type) {
  role = type;
}

function render() {
  $toolBox.innerHTML = "";
  renderVismfile(vismfileName, vismfile, role);
  renderVisfile(visfileName, visfile, role);
}

export default {
  create: create,
  renderVismfile: renderVismfile,
  renderVisfile: renderVisfile,
  setVisfile: setVisfile,
  setRole: setRole,
  setVismfile: setVismfile,
  render: render,
  setSaveVismfileMethod: setSaveVismfileMethod
}
