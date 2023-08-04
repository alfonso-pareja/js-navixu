const routes = require('express').Router();
const bodyParser = require('body-parser');
const alertsController = require('../controllers/alert/AlertsController');
const trackListController = require('../controllers/tracks/TrackListController');


const navixy = require('./navixy');



routes.use(bodyParser.urlencoded({ extended: true }));
routes.use(bodyParser.json());

routes.use((req, res, next) => {
  console.log(`Resource requested: ${req.method} ${req.originalUrl}`);
  next();
});

routes.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Hello world!' });
});
routes.get('/devices/list', navixy)
routes.get('/track/list')


routes.get('/v1/alerts', async(req, res) => {
  const list_data = await alertsController.getAlertsList(); 
  res.json(list_data);
});

routes.get('/v1/task/list', async (req, res) => {
  const list_data = await trackListController.getInfoNavixy()
  res.json(list_data);
})



module.exports = routes;