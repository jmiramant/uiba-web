import 'babel-polyfill';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import expressJwt from 'express-jwt';
import expressGraphQL from 'express-graphql';
import jwt from 'jsonwebtoken';
import React from 'react';
import ReactDOM from 'react-dom/server';
import Html from './components/Html';
import mongoose from 'mongoose';
import { ErrorPage } from './routes/error/ErrorPage';
import errorPageStyle from './routes/error/ErrorPage.css';
import UniversalRouter from 'universal-router';
import PrettyError from 'pretty-error';
import User from './data/models';
import routes from './routes';
import assets from './assets'; // eslint-disable-line import/no-unresolved
import configureStore from './store/configureStore';
import { setRuntimeVariable } from './actions/runtime';
import { port, auth } from './config';
import bcrypt from 'bcrypt';

if (!process.env.JWT_SECRET) {
  console.error('ERROR!: Please set JWT_SECRET before running the app. \n run: export JWT_SECRET=<some secret string> to set JWTSecret. ')
  process.exit();
}

const app = express();
const router = express.Router();

mongoose.connect(process.env.MONGOLAB_URI || 'mongodb://localhost/uiba');
let db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('DB connected!');
});

//utility func
function isUserUnique(reqBody, cb) {
  var username = reqBody.username ? reqBody.username.trim() : '';
  var email = reqBody.email ? reqBody.email.trim() : '';

  User.findOne({
    $or: [{
      'username': new RegExp(["^", username, "$"].join(""), "i")
    }, {
      'email': new RegExp(["^", email, "$"].join(""), "i")
    }]
  }, function(err, user) {
    if (err) throw err;

    if (!user) {
      cb();
      return;
    }

    var err;
    if (user.username === username) {
      err = {};
      err.username = '"' + username + '" is not unique';
    }
    if (user.email === email) {
      err = err ? err : {};
      err.email = '"' + email + '" is not unique';
    }

    cb(err);
  });
}


router.get('/users/?', function(req, res) {

  if (!req.user || !req.user.admin)
    return res.status(401).json({
      error: 'You must be admin to access this route.'
    });

  User
    .find({})
    .select({
      password: 0,
      __v: 0,
      updatedAt: 0,
      createdAt: 0
    }) //make sure to not return password (although it is hashed using bcrypt)
    .limit(100)
    .sort({
      createdAt: -1
    })
    .exec(function(err, users) {
      if (err) {
        console.log(err);
        return res.status(500).json({
          error: 'Could not retrieve users'
        });
      }
      res.json(users);
    });
});

router.post('/users/signin', function(req, res) {
  User
    .findOne({
      username: req.body.username
    })
    .select({
      __v: 0,
      updatedAt: 0,
      createdAt: 0
    }) //make sure to not return password (although it is hashed using bcrypt)
    .exec(function(err, user) {
      if (err) throw err;

      if (!user) {
        return res.status(404).json({
          error: true,
          message: 'Username or Password is Wrong'
        });
      }


      bcrypt.compare(req.body.password, user.password, function(err, valid) {
        if (!valid) {
          return res.status(404).json({
            error: true,
            message: 'Username or Password is Wrong'
          });
        }

        //make sure to NOT pass password and anything sensitive inside token
        //Pass anything tht might be used in other parts of the app
        var token = utils.generateToken(user);

        user = utils.getCleanUser(user);

        res.json({
          user: user,
          token: token
        });
      });
    });
});



router.post('/users/signup', function(req, res, next) {
  var body = req.body;


  var errors = utils.validateSignUpForm(body);
  if (errors) {
    return res.status(403).json(errors);
  }

  isUserUnique(body, function(err) {
    if (err) {
      res.status(403).json(err);
    }

    var hash = bcrypt.hashSync(body.password.trim(), 10);
    var user = new User({
      name: body.name.trim(),
      username: body.username.trim(),
      email: body.email.trim(),
      password: hash,
      admin: false,
      isEmailVerified: false
    });

    user.save(function(err, user) {
      if (err) throw err;

      email.sendWelcomeEmail(user, req.headers.host); //send welcome email w/ verification token

      var token = utils.generateToken(user);

      user = utils.getCleanUser(user);

      res.json({
        user: user,
        token: token
      });
    });

  });
});



//currently validating uniqueness for username
router.post('/users/validate/fields', function(req, res, next) {
  var body = req.body;

  isUserUnique(body, function(err) {
    if (err) {
      res.status(403).json(err);
    } else {
      return res.json({});
    }
  });
});

//get current user from token
router.get('/me/from/token', function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if (!token) {
    return res.status(401).json({
      message: 'Must pass token'
    });
  }

  // decode token
  jwt.verify(token, process.env.JWT_SECRET, function(err, user) {
    if (err) throw err;

    //return user using the id from w/in JWTToken
    User.findById({
      '_id': user._id
    }, function(err, user) {
      if (err) throw err;

      user = utils.getCleanUser(user); //dont pass password and stuff

      //note: you can renew token by creating new token(i.e. refresh it) w/ new expiration time at this point, but I'm passing the old token back.
      // var token = utils.generateToken(user);

      res.json({
        user: user,
        token: token
      });

    });
  });
});

router.get('/resendValidationEmail', expressJwt({
  secret: process.env.JWT_SECRET
}), function(req, res, next) {

  User.findById({
    '_id': req.user._id
  }, function(err, user) {
    if (err) throw err;

    //send welcome email w/ verification token
    email.sendWelcomeEmail(user, req.headers.host, function(err) {
      if (err) {
        res.status(404).json(err);
      } else {
        res.send({
          message: 'Email was resent'
        })
      }
    });
  });
});


router.post(
  '/updateEmail',
  expressJwt({
    secret: process.env.JWT_SECRET
  }),
  function(req, res, next) {

    var newEmail = req.body.email && req.body.email.trim();

    User.findOneAndUpdate({
      '_id': req.user._id
    }, {
      email: newEmail
    }, {
      new: true
    }, function(err, user) {
      if (err) throw err;

      console.dir(user.toJSON());
      //send welcome email w/ verification token
      email.sendWelcomeEmail(user, req.headers.host);

      res.json({message: 'Email was updated'});

    });
  });




//get current user from email-token(from w/in welcome email)
router.get('/validateEmail/:token', function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.params.token;
  if (!token) {
    return res.status(401).json({
      message: 'Must pass token'
    });
  }

  User.findOne({
    verifyEmailToken: req.params.token,
    verifyEmailTokenExpires: {
      $gt: Date.now()
    }
  }, function(err, user) {

    if (!user) {
      return res.status(404).json({
        message: 'Email token is not valid or has expired'
      });
    }

    user.isEmailVerified = true;
    user.verifyEmailToken = undefined;
    user.verifyEmailTokenExpires = undefined;
    user.save(function(err) {
      user = utils.getCleanUser(user); //dont pass password and stuff
      var token = utils.generateToken(user);
      res.json({
        user: user,
        token: token
      });
    });
  });
});







//
// Tell any CSS tooling (such as Material UI) to use all vendor prefixes if the
// user agent is not known.
// -----------------------------------------------------------------------------
global.navigator = global.navigator || {};
global.navigator.userAgent = global.navigator.userAgent || 'all';
//
// Register Node.js middleware
// -----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//
// Register server-side rendering middleware
// -----------------------------------------------------------------------------
app.get('*', async (req, res, next) => {
  try {
    let css = [];
    let statusCode = 200;
    const data = { title: '', description: '', style: '', script: assets.main.js, children: '' };

    const store = configureStore({}, {
      cookie: req.headers.cookie,
    });

    store.dispatch(setRuntimeVariable({
      name: 'initialNow',
      value: Date.now(),
    }));

    await UniversalRouter.resolve(routes, {
      path: req.path,
      query: req.query,
      context: {
        store,
        insertCss: (...styles) => {
          styles.forEach(style => css.push(style._getCss())); // eslint-disable-line no-underscore-dangle, max-len
        },
        setTitle: value => (data.title = value),
        setMeta: (key, value) => (data[key] = value),
      },
      render(component, status = 200) {
        css = [];
        statusCode = status;
        data.children = ReactDOM.renderToString(component);
        data.style = css.join('');
        data.state = store.getState();
        return true;
      },
    });

    const html = ReactDOM.renderToStaticMarkup(<Html {...data} />);

    res.status(statusCode);
    res.send(`<!doctype html>${html}`);
  } catch (err) {
    next(err);
  }
});

//
// Error handling
// -----------------------------------------------------------------------------
const pe = new PrettyError();
pe.skipNodeFiles();
pe.skipPackage('express');

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.log(pe.render(err)); // eslint-disable-line no-console
  const statusCode = err.status || 500;
  const html = ReactDOM.renderToStaticMarkup(
    <Html
      title="Internal Server Error"
      description={err.message}
      style={errorPageStyle._getCss()} // eslint-disable-line no-underscore-dangle
    >
      {ReactDOM.renderToString(<ErrorPage error={err} />)}
    </Html>
  );
  res.status(statusCode);
  res.send(`<!doctype html>${html}`);
});

