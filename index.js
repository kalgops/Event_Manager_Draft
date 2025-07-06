// index.js
const express       = require('express');
const session       = require('express-session');
const path          = require('path');
const portfinder    = require('portfinder');
const cookieParser  = require('cookie-parser');

const db              = require('./db');
// expose the db instance so routers expecting `global.db` continue to work
global.db = db;
const authRouter      = require('./routes/auth');
const { ensureAdmin } = require('./middleware/auth');
const organiserRouter = require('./routes/organiser');
const attendeeRouter  = require('./routes/attendee');

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT,10) || 3000;

app.set('view engine','ejs');
app.set('views', path.join(__dirname,'views'));
app.use(express.static(path.join(__dirname,'public')));
app.use(express.urlencoded({ extended:true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'your-secret-here',
  resave: false,
  saveUninitialized: false
}));

app.use((req,res,next)=>{
  res.locals.session = req.session;
  next();
});

app.use('/',          authRouter);
app.use('/organiser', ensureAdmin, organiserRouter);
app.use('/attendee',  attendeeRouter);

app.get('/', (req,res)=> {
  res.render('index',{ title:'Home' });
});

app.use((req,res)=> {
  res.status(404).render('404',{ title:'Not Found' });
});
app.use((err,req,res,next)=> {
  console.error(err);
  res.status(500).render('500',{ title:'Error' });
});

portfinder.basePort = DEFAULT_PORT;
portfinder.getPortPromise()
  .then(port => app.listen(port,()=>console.log(`🚀 http://localhost:${port}`)))
  .catch(err=> { console.error('❌ No free port',err); process.exit(1);} );
