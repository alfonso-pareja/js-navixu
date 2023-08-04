const express = require('express');
const cors    = require('cors');
const routes  = require('./app/routes');

const app = express();

const port = process.env.PORT || 8080; // set our port

app.use(cors({ origin: '*' }));
app.use('/', routes);


app.use((err, req, res, next) => {
  res.status(err.status || 400).json({
    success: false,
    message: err.message || 'An error occured.',
    errors: err.error || [],
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Resource not found.' });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message  || 'Error del servidor';

  res.status(statusCode).json({ error: errorMessage });
});



// Start the server
app.listen(port);

console.log(`Server started on port ${port}`);