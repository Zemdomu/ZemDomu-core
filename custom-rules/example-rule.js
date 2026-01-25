module.exports = {
  name: "noFoo",
  test: (node) =>
    (node.type === "element" && node.tagName === "foo") ||
    (node.type === "JSXElement" &&
      node.openingElement &&
      node.openingElement.name &&
      node.openingElement.name.name === "foo"),
  message: "<foo> is not allowed",
};
