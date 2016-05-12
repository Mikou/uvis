let ts;
let current = null;

function skip_separator() {
  var tok = ts.peek();
  if (tok.type == "separator") ts.next();
  else ts.croak("Expecting a Template Separator : ");
}

function skip_EOL() {
  var tok = ts.peek();
  if (tok.type === "EOL") ts.next();
  else ts.croak("Expecting EOL");
}

function parseAtom () {
  const tok = ts.next();
  return tok.value;
}

function parseFormula () {
  while(!ts.eof() && ts.peek().type !== 'EOL') {
    return parseAtom();
  }
}

function parseProperty () {
  var key = ts.next();
            ts.next(); // jump over semicolon op;
  var exp = parseFormula();
  return {key: key.value, value: exp};
}

function parseTemplate () {
  let template = {};
  while( !ts.eof() && ts.peek().type !== 'separator' ) {
    while( ts.peek().type === 'EOL' ) skip_EOL();
    let property = parseProperty();
    template[property.key] = property.value;
    if(!ts.eof()) skip_EOL();
  }

  if(ts.peek() && ts.peek().type === 'separator') skip_separator();
  return template;
}  

function readNext() {
  if(ts.eof()) return null;

  return parseTemplate();
}

function eof () {
  return peek() === null;
}

export function parse() {
  const visMap = {};
  const headerTemplate = parseTemplate();
  visMap.startUpForm = headerTemplate.StartUpForm;
  const dbTemplate = parseTemplate();
  visMap.database = dbTemplate.Database;
  const schema = {};
  while(!ts.eof()) {
    const table = parseTemplate();
    const tableName = table.Table;
    delete table["Table"];
    schema[tableName] = table;
  }

  visMap.schema = schema;
  return visMap;
}

export function init (tokenStream) {
  ts = tokenStream;
};

