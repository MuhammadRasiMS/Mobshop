var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var adminRouter = require('./routes/admin');
var usersRouter = require('./routes/users');
var exbs = require('express-handlebars');

var db = require('./config/connection')
var session = require('express-session');

var app = express();

const hbs=exbs.create({
  extname: 'hbs',defaultLayout: 'layout',
  layoutsDir: __dirname + '/views/layout/',
  partialsDir: __dirname + '/views/partials/',
  helpers:{
    ifEquals: (value1,value2,options) => {

      if (value1 == value2) {
        
        return options.fn()
      } else {
        
        return options.inverse();
      }
    },
    ifStatusEquals: (status, value1, value2, value3, options)=>{
      if(status==value1 || status==value2 || status==value3){
        return options.fn()
      }
    },
    ifQuantityEquals:(value1,value2,options)=>{
      if(value1==value2){
        return options.fn()
      }else{
        return options.inverse();
      }
    }
  }
  
})

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.engine('hbs', hbs.engine)
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({ secret: "key", resave: false, saveUninitialized: false, 
}))

app.use((req, res, next) => {
  res.set('cache-control', 'no-store')
  next();
})
db.connect((err) => {
  if (err) throw err;
  console.log("database connected")
})

app.use('/admin', adminRouter);
app.use('/', usersRouter);


app.get('/*',(req,res)=>{
  res.render('notfound')
})
// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
