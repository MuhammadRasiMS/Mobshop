var express = require('express');
var router = express.Router();
var userHelpers = require('../helpers/user-helpers');
require('dotenv').config()
const accountSID = process.env.ACCOUNTSID;
const authToken = process.env.AUTHTOKEN;
const serviceID = process.env.SERVICEID;
var client = require('twilio')(accountSID,authToken)

const paypal = require('paypal-rest-sdk');

paypal.configure({
  'mode': 'sandbox', //sandbox or live
  'client_id': process.env.CLIENT_ID,
  'client_secret': process.env.CLIENT_SECRET
});
/* GET users listing. */
router.use('/',async(req,res,next)=>{
  if(req.session.user){
    wishListCount = await userHelpers.getWishListCount(req.session.user._id)
    cartCount = await userHelpers.getCartCount(req.session.user._id)
    res.locals.wishListCount = wishListCount;
    res.locals.cartCount = cartCount;
  }else{
    res.locals.wishListCount = null;
    res.locals.cartCount = null;

  }
  req.app.locals.layout = 'layout'
  next()
})

/* <---------------------------------------------Home Page--------------------------------------------------> */

router.get('/',async (req,res,next) => {
  var vUser = req.session.user;
  let category = await userHelpers.getCategoryDetails();
  let products = await userHelpers.getAllProducts();
  let cartCount = null;
  let wishListCount = null;
  if (req.session.user) {
    cartCount = await userHelpers.getCartCount(req.session.user._id);
    req.session.user.cartCount = cartCount;
    wishListCount = await userHelpers.getWishListCount(req.session.user._id)
    req.session.user.wishListCount = wishListCount;
    res.render('users/home',{ vUser,category,products,wishListCount,user: true });
  }else{
    res.render('users/home',{ user: true,products,category })
  }
});

/* <---------------------------------------------User Signup--------------------------------------------------> */

router.get('/signup',loggedInChecker,(req,res,next) => {
  if (req.session.signupErr) {
    res.render('users/signup',{ signupErr: req.session.signupErr });
    return req.session.signupErr = false;
  }
  res.render('users/signup',{user:true});
})

router.post('/signup',verifySignup,(req,res) => {
  userHelpers.doSignup(req.body).then((data) => {
    console.log(data);
    userHelpers.getUsertDetails(data.insertedId).then(response => {
      req.session.userLoggedIn = true;
      req.session.user = response;
      res.redirect('/')
    })
  }).catch(err => {
    if (err) throw err;
  })
})

function verifySignup(req,res,next) {
  userHelpers.doVerifySignup(req.body).then(verify => {
    if (verify) {
      req.session.signupErr = "Email already exists";
      return res.redirect('/signup');
    } else {
      next();
    }
  })
}

/* <---------------------------------------------User Login--------------------------------------------------> */

router.get('/login',(req,res,next) => {
  if (req.session.userLoggedIn) {
    res.redirect('/')
  } else {
    res.render('users/login',{ loginErr: req.session.loginErr ,user:true})
    req.session.loginErr = false;
  }
})

router.get('/logout',(req,res) => {
  req.session.user = null;
  req.session.userLoggedIn = false;
  res.redirect('/login')
})

router.post('/login',(req,res) => {
  userHelpers.doLogin(req.body).then(response => {
    if (response.status) {
      if (response.user.status) {
        req.session.userLoggedIn = true;
        req.session.user = response.user;
        res.redirect('/');
      } else {
        req.session.loginErr = "user is blocked"
        res.redirect('/login')
      }
    } else {
      req.session.loginErr = "invalid user";
      res.redirect('/login')
    }
  })
})

/* <---------------------------------------------OTP Login--------------------------------------------------> */

router.get('/otp-login',loggedInChecker,(req,res) => {
  if (req.session.otpLoginErr) {
    res.render('users/otp-login',{ otpLoginErr: req.session.otpLoginErr })
    return req.session.otpLoginErr = false;
  }
  res.render('users/otp-login',{user:true})
})

router.get('/otp-verify',loggedInChecker,(req,res) => {
  if (req.session.otpCodeErr) {
    res.render('users/otp-verify',{ otpCodeErr: req.session.otpCodeErr })
    return req.session.otpCodeErr = false;
  }
  res.render('users/otp-verify',{user:true})
})

router.post('/otp-login',(req,res) => {
  userHelpers.doOtpLogin(req.body).then((response) => {
    if (response.status) {
      if (response.user.status) {
        req.session.phoneNumber = req.body.phoneNumber;
        client.verify.services(serviceID).verifications.create({
          to: `+91${req.body.phoneNumber}`,
          channel: 'sms',
        }).then((data) => {
          if (data) {
            res.redirect('/otp-verify');
          }
        })
      } else {
        req.session.otpLoginErr = "user is blocked";
        res.redirect('/otp-login')
      }
    } else {
      req.session.otpLoginErr = "Invalid phone number";
      res.redirect('/otp-login')
    }
  })
})

router.post('/resent',(req,res) => {
  client.verify.services(serviceID).verifications.create({
    to: `+91${req.session.phoneNumber}`,
    channel: 'sms',
  }).then((data) => {
    if (data) {
      res.redirect('/otp-verify')
    }
  })
})

router.post('/otp-verify',(req,res) => {
  req.session.code = req.body.code;
  client.verify.services(serviceID).verificationChecks.create({
    to: `+91${req.session.phoneNumber}`,
    code: req.session.code
  }).then((data) => {
    if (data.status === 'approved') {
      userHelpers.doOtpLogin(req.session).then((response) => {
        if (response.status) {
          req.session.user = response.user;
          req.session.userLoggedIn = true;
          req.session.phoneNumber = false;
          res.redirect('/');
        }
      })
    } else {
      req.session.otpCodeErr = "Invalid otp-number"
      res.redirect('/otp-verify');
    }
  })
})

/* <---------------------------------------------User Logged Or Not--------------------------------------------------> */

function loggedInChecker(req,res,next) {
  if (req.session.userLoggedIn) {
    return res.redirect('/')
  }
  next();
}

function notLoggedInChecker(req,res,next) {
  if (req.session.userLoggedIn) {
    return next();
  }
  return res.redirect('/login')
}

/* <---------------------------------------------Product View Page--------------------------------------------------> */

router.get('/view-product/:id',(req,res,next) => {
  let productId = req.params.id;
  userHelpers.getProductDetails(productId).then(product => {
    res.render('./users/view-product',{ vUser: req.session.user, user: true,product })   
  })
})

/* <---------------------------------------------Products List Page--------------------------------------------------> */

router.get('/products-list',verifySignup,async (req,res,next) => {
  let vUser = req.session.user;
  let brand = await userHelpers.getCategoryDetails();
  const page = parseInt(req.query.page)
  const limit = 4
  const startIndex = (page - 1) * limit
  const endIndex = page * limit
  const results = {}

  let productsCount = await userHelpers.getProductsCount()

  if(endIndex < productsCount){
    results.next = {
      page: page + 1,
      limit: limit
    }
  }
  if(startIndex > 0){
    results.previous = {
      page: page - 1,
      limit: limit
    }
  }
  
  let products = await userHelpers.getPaginatedProducts(limit,startIndex);
  if(req.session.filterProducts){
    products= req.session.filterProducts
  }
  results.pageCount = Math.ceil(parseInt(productsCount) / parseInt(limit)).toString()
  results.pages = Array.from({ length: results.pageCount },(_,i) => i + 1)
  results.currentPage = page.toString()

  res.render('users/products-list',{ vUser,brand,products,results,user: true })
  req.session.filterProducts = false
})

/* <---------------------------------------------Filter Products--------------------------------------------------> */

router.post('/filter',async (req,res) => {
  await userHelpers.filterProducts(req.body.brand).then((products) => {
    req.session.filterProducts = products;
    res.redirect('/products-list')
  })
})

/* <---------------------------------------------Search Products--------------------------------------------------> */

router.post('/getSearchProducts',async (req,res) => {
  let payload = req.body.payload.trim();
  let search = await userHelpers.searchProduct(payload)
  //Limit search results to 10
  search = search.slice(0,10);
  res.send({ payload: search });
})

/* <---------------------------------------------User Dashboard--------------------------------------------------> */

router.get('/dashboard',notLoggedInChecker,async (req,res) => {
  let userId = req.session.user._id
  let userAddress = await userHelpers.getUsertDetails(userId)
  let walletData = await userHelpers.walletAmountCheckForUser(userId)
  walletBalance = parseInt(walletData)
  let orders = await userHelpers.getUserOrders(userId)
  res.render('users/dashboard',{ user: true,vUser: req.session.user,orders,userAddress, walletBalance })
})

/* <---------------------------------------------Wishlist--------------------------------------------------> */

router.post("/addToWishList",(req,res) => {
  userHelpers.addToWishList(req.body,req.session.user._id).then(() => {
    res.json({ login: true });
  });
})

router.get('/wishlist',notLoggedInChecker,async (req,res) => {
  userHelpers.getWishListProducts(req.session.user._id).then((products) => {
    if (products.noItem) {
      let wishListMessage = products.noWishListMessage;
      res.render("users/wishlist",{
        user: true,
        wishListMessage,
        vUser: req.session.user
      });
    } else {
      res.render('users/wishlist',{ vUser: req.session.user,user: true,products })
    }
  })
})

router.post("/delete-wishlist-product",(req,res) => {
  userHelpers.removeWishListProduct(req.body).then((response) => {
    res.json(response);
  })
})

/* <---------------------------------------------User Cart--------------------------------------------------> */

router.get('/add-to-cart/:id',(req,res) => {
  userHelpers.addToCart(req.params.id,req.session.user._id).then(() => {
    res.json({ status: true })
  })
})

router.get('/cart',verifySignup,async (req,res,next) => {
  if (req.session.userLoggedIn) {

    cartCount = await userHelpers.getCartCount(req.session.user._id);
    req.session.user.cartCount = cartCount;

    let category = await userHelpers.getCategoryDetails();
    let products = await userHelpers.getCartProducts(req.session.user._id)
    let totalValue = await userHelpers.getTotalAmount(req.session.user._id);
    let couponObj ={};
    if(req.session.discountPrice){
      couponObj.discountPrice = Math.round(req.session.discountPrice)
      couponObj.totalPriceAfterOffer = Math.round(req.session.totalPriceAfterOffer)
      couponObj.couponAppliedSuccess = req.session.couponAppliedSuccess
      couponObj.couponCode = req.session.couponCode
    }
    userId = req.session.user._id
    res.render('users/cart',{ vUser: req.session.user,totalValue,userId,category, couponObj, products,user: true })
  } else {
    res.redirect('/login')
  }
})

router.get('/remove-cart/:id',(req,res) => {
  let productId = req.params.id;
  if (req.session.userLoggedIn) {
    userHelpers.removeCart(productId,req.session.user._id).then(() => {
      res.redirect('/cart')
    })
  }
})

/* <---------------------------------------------Coupon--------------------------------------------------> */

router.post('/enter-coupon',async (req,res) => {
  let userId = req.session.user._id
  let totalPrice = await userHelpers.getTotalAmount(userId)
  let total = totalPrice.grandtotal
  userHelpers.applyCoupon(req.body,total,userId).then((response) => {
    req.session.discountPrice = response.discountPrice
    req.session.totalPriceAfterOffer = response.totalPriceAfterOffer
    req.session.couponAppliedSuccess = response.couponAppliedSuccess
    req.session.couponCode = req.body.code
    res.json(response)
  })
})

router.get('/delete-coupon',async(req,res)=>{
  req.session.couponAppliedSuccess = ''
  req.session.couponCode = ''
  await userHelpers.deleteCoupon(req.session.user._id)
  res.redirect('/cart')
})

/* <---------------------------------------------Quantity changing--------------------------------------------------> */

router.post('/change-product-quantity',(req,res,next) => {
  userHelpers.changeProductQuantity(req.body).then(async (response) => {
    response.total = await userHelpers.getTotalAmount(req.body.user)
    res.json(response)
  })
})

/* <---------------------------------------------Checkout Page--------------------------------------------------> */

router.get('/place-order',notLoggedInChecker,async (req,res,next) => {
  let userId = req.session.user._id
  let address = await userHelpers.getUserAddress(userId);
  let cartCount = await userHelpers.getCartCount(req.session.user._id);
  if(cartCount){
    userHelpers.getCartProducts(userId).then((cartItems) => {
      userHelpers.getTotalAmount(userId).then(async (total) => {
        let totalAmount = total.grandtotal
      let discount = await userHelpers.getCartDiscount(totalAmount,userId)
      let walletBalance = await userHelpers.walletAmountCheckForUser(userId)
        res.render('users/checkout',{ vUser: req.session.user,total,cartItems,totalAmount,walletBalance,user: true,address,discount })
    })
    
  })
}else{
  res.redirect('/')
}
})

router.post('/place-order',async (req,res) => {
  userId = req.session.user._id;
  let products = await userHelpers.getCartProductList(req.body.userId)
  let totalPrice = await userHelpers.getTotalAmount(req.body.userId)
  req.session.discountPrice= ''
  userHelpers.placeOrder(req.body,products,totalPrice).then(async(orderId) => {
    if (req.body['paymentMethod'] == 'COD') {
      userHelpers.getOrderProductQuantity(orderId).then((data) => {
        data.forEach((element) => {
          userHelpers.stockDecrease(element);
        });
      });
      userHelpers.removeCoupon(userId).then(()=>{
        res.json({ codSuccess: true });
      });
    } else if (req.body['paymentMethod']=='wallet'){
      let walletAmount = await userHelpers.walletAmountCheck(userId,totalPrice)
      console.log("walletAmount");

      console.log(walletAmount);
      if(walletAmount != null){
        paymentWallet = await userHelpers.walletAmountReduce(userId, totalPrice, walletAmount)
        orderStatus = await userHelpers.changePaymentStatus(orderId)
        userHelpers.getOrderProductQuantity(orderId).then((data)=>{
          data.forEach((element)=>{
            userHelpers.stockDecrease(element);
          });
        });
        req.session.applyCoupon = false
        res.json({wallet:true,orderId:orderId})
      }else{
        res.json({walletErr : true})
      }
      
    } else if (req.body['paymentMethod'] == 'UPI') {
      userHelpers.generateRazorpay(orderId,totalPrice).then((response) => {
        console.log(response);
        res.json({ response,razorpay: true })
      })
    } else {
      res.json({ paypal: true, orderId:orderId }) 
    }
  })
})

/* <---------------------------------------------Shipping Address--------------------------------------------------> */

router.get('/add-address',notLoggedInChecker,(req,res) => {
  res.render('users/add-address',{ user: true,vUser: req.session.user })
})

router.post('/add-address',async (req,res) => {
  await userHelpers.addAddress(req.body,req.session.user._id);
  res.redirect('/place-order')
})

router.get('/delete-ship-address/:id',(req,res)=>{
  let addressId = req.params.id;
    userHelpers.deleteShipAddress(addressId).then(()=>{
      res.redirect('/place-order')  
  })
})

/* <---------------------------------------------Payment--------------------------------------------------> */

router.post('/verify-payment',(req,res) => {
  console.log(req.body);
  userHelpers.verifyPayment(req.body).then(() => {
    userHelpers.changePaymentStatus(req.body['order[receipt]']).then(() => {
      res.json({ status: true })
    })
  }).catch((err) => {
    console.log(err);
    res.json({ status: false,errMsg: '' })
  })
})

router.get('/pay/:id',(req,res) => {
  orderId = req.params.id
  console.log('orderId');
  console.log(orderId);
  const create_payment_json = {
    "intent": "sale",
    "payer": {
      "payment_method": "paypal"
    },
    "redirect_urls": {
      "return_url": "http://mobshop.cf/order-success/"+orderId,
      "cancel_url": "http://mobshop.cf/cancel"
    },
    "transactions": [{
      "amount": {
        "currency": "USD",
        "total": "25.00"
      },

    }]
  };

  paypal.payment.create(create_payment_json,function (error,payment) {
    if (error) {
      throw error;
    } else {
      for (let i = 0; i < payment.links.length; i++) {
        if (payment.links[i].rel === 'approval_url') {
          res.json(payment.links[i].href);
        }
      }
    }
  });
});


router.get('/success',(req,res) => {
  orderId = req.query.orderId
  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId;
  const execute_payment_json = {
    "payer_id": payerId,
    "transactions": [{
      "amount": {
        "currency": "USD",
        "total": "25.00"
      }
    }]
  };

  paypal.payment.execute(paymentId,execute_payment_json,function (error,payment) {
    if (error) {
      console.log(error.response);
      throw error;
    } else {
      console.log(JSON.stringify(payment));
      res.redirect('/order-success');
    }
  });
}); +

  router.get('/cancel',(req,res) => res.send('Cancelled'));

/* <---------------------------------------------Order Success Page--------------------------------------------------> */

router.get('/order-success',notLoggedInChecker,async(req,res) => {
  let userId = req.session.user._id
  await userHelpers.deleteCart(userId)
  res.render('users/order-success')
})

router.get('/order-success/:id',notLoggedInChecker,async(req,res)=>{
  let data = {
    orderId: req.params.id,
    userId: req.session.user._id,
    status: 'placed'
  }
  let userId = req.session.user._id
  await userHelpers.deleteCart(userId)
  await userHelpers.updateOrderStatus(data)
  res.redirect('/order-success')
})
/* <---------------------------------------------User Orders--------------------------------------------------> */

router.get('/orders',notLoggedInChecker,async (req,res) => {
  let userId = req.session.user._id;
  let products = await userHelpers.getAllProducts();
  let orders = await userHelpers.getUserOrders(userId)
  res.render('users/orders',{ vUser: req.session.user, userId,orders,products,user: true})
})

/* <---------------------------------------------Order Cancel--------------------------------------------------> */

router.get('/order-cancel/:id',notLoggedInChecker,async (req,res) => {
  orderId = req.params.id
  await userHelpers.cancelOrder(orderId);
  userHelpers.getOrderProductQuantity(orderId).then((data) => {
    data.forEach((element) => {
      userHelpers.stockIncrease(element);
    });
  })
  res.redirect('/orders')
})

/* <---------------------------------------------View Ordered Products--------------------------------------------------> */

router.get('/view-order-products/:id',notLoggedInChecker,async (req,res) => {
  orderId = req.params.id
  let products = await userHelpers.getOrderProducts(orderId)
  let orderStatus = await userHelpers.getOrderStatus(orderId)
  res.render('users/view-order-products',{ vUser: req.session.user,user: true,products,orderId, orderStatus })
})

/* <---------------------------------------------Invoice--------------------------------------------------> */

router.get('/view-invoice/:id',async (req,res) => {
  let orderId = req.params.id
  let orders = await userHelpers.getInvoice(orderId);
  let orderProducts = await userHelpers.getOrderProducts(orderId);
  res.render('users/view-invoice',{ vUser: req.session.user,user: true,orders,orderProducts })
})

/* <---------------------------------------------Order return--------------------------------------------------> */

router.post('/return-order/',async(req,res)=>{
 let status = await userHelpers.updateOrderStatus(req.body);
 userHelpers.returnOrder(req.body).then(()=>{
   res.redirect('/orders')
 })
})

module.exports = router;

