var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");

// Create a new express app
const app = express();
// Set an initial port
const PORT = process.env.PORT || 3000;


// Run Morgan for Logging
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.text());
app.use(bodyParser.json({type: "application/vnd.api+json"}));
app.use(express.static("./public"));


// -------------------------------------------------

// Main "/" Route. Redirect user to React App
app.get("/", function (req, res) {
    res.sendFile(__dirname + "/public/index.html");
});


// -------------------------------------------------

// Server Start
app.listen(PORT, function () {
    console.log("App listening on PORT: " + PORT);
});
