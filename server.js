const express = require("express");
const path = require("path");
const routes = require("./src/routes");
const { seedDemoData } = require("./src/store");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(routes);

seedDemoData();

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Leave workflow engine running at http://127.0.0.1:${PORT}`);
});
