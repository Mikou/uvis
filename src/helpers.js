function createPathReader (path) {
  function next () {
    const value = peek();
    path = (value !== null) ? path.next : undefined;
    return value;
  }
  function hasNext() {
    return (typeof path !== 'undefined');
  }
  function peek () {
    if(typeof path === 'undefined') return null;
    return path.content;
  }
  function getIndex () {
    return path.index;
  }

  return {
    hasNext: hasNext,
    next: next,
    peek: peek,
    getIndex: getIndex
  }
}

export default {
  createPathReader: createPathReader
}
