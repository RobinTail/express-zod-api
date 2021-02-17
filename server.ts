import * as express from 'express';
import {initRouting, routing} from './routing';

const app = express();
app.use(express.json());
initRouting(app, routing);

app.listen(8090, () => {
  console.log('Listening...');
});
