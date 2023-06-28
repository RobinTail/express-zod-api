require("ts-node").register({ transpileOnly: true, swc: true });
module.exports = require("./rules").default;
