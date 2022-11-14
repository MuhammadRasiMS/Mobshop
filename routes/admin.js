const { response } = require('express');
var express = require('express');
var router = express.Router();
var adminHelpers = require('../helpers/admin-helpers')
const {upload} = require('../public/javascripts/fileUpload')
var responseErrCat
var responseSuCat
var couponErrMssg
var couponSuccessMssg
var admin = {
  email: 'admin@gmail.com',
  password: '12345'
}

/* <---------------------------------------------Admin Dashboard--------------------------------------------------> */

router.get('/',verifyAdmin,async (req,res) => {
  let response = await adminHelpers.getTotalSaleGraph()
  let { dailySales,monthlySales,yearlySales } = response;
  let salesReport = await adminHelpers.getSalesReport();
  let { weeklyReport,monthlyReport,yearlyReport } = salesReport
  console.log(weeklyReport,monthlyReport,yearlyReport);

  let paymentsReport = await adminHelpers.getPaymentGraph();
  let { percentageCOD,percentageUPI,percentagePaypal } = paymentsReport
  res.render('./admin/home',{ admin: true,dailySales,monthlySales,yearlySales,
    weeklyReport,monthlyReport,yearlyReport,
    percentageCOD,percentageUPI,percentagePaypal })
})

/* <---------------------------------------------Admin Login--------------------------------------------------> */

router.get('/login',function (req,res,next) {
  if (req.session.adminLoggedIn) {
    res.redirect('/admin')
  } else {
    res.render('./admin/login',{ adminLoginErr: req.session.adminLoginErr });
    adminLoginErr = false;

  }
});

router.post('/login',(req,res) => {
  if (req.body.email === admin.email && req.body.password === admin.password) {
    req.session.admin = req.body;
    req.session.adminLoggedIn = true;
    res.redirect('/admin')
  } else {
    req.session.adminLoginErr = 'Invalid admin'
    res.redirect('/admin/login')
  }
});

router.get('/logout',(req,res) => {
  req.session.admin = null;
  req.session.adminLoggedIn = false;
  res.redirect('/admin/login')
});

function verifyAdmin(req,res,next) {
  if (req.session.adminLoggedIn) {
    return next();
  }
  res.redirect('/admin/login')
}

/* <---------------------------------------------Admin Products List--------------------------------------------------> */

router.get('/products',verifyAdmin,async(req,res) => {
  const page = parseInt(req.query.page)
  const limit = 4
  const startIndex = (page - 1) * limit
  const endIndex = page * limit
  const results = {}
  let productsCountAd = await adminHelpers.getproductsCountAd()
  if (endIndex < productsCountAd) {
    results.next = {
      page: page + 1,
      limit: limit
    }
  }
  if (startIndex > 0) {
    results.previous = {
      page: page - 1,
      limit: limit
    }
  }

  let products = await adminHelpers.getAllProducts(limit,startIndex);
  results.pageCount = Math.ceil(parseInt(productsCountAd)/parseInt(limit)).toString()
  results.pages = Array.from({length: results.pageCount},(_,i) => i + 1)
  results.currentPage = page.toString()
  res.render('./admin/products',{ admin: true,products, results })
  
});

/* <---------------------------------------------Add Product--------------------------------------------------> */

router.get('/add-product',verifyAdmin,async (req,res,next) => {
  let category = await adminHelpers.getCategoryDetails();
  res.render('admin/add-product',{ category,admin: true })
});


router.post('/add-product',upload.array('image'),verifyAdmin,(req,res,next) => {
  const files = req.files

  const file = files.map((file)=>{
    return file
  })

  const fileName = file.map((file)=>{
    return file.filename
  })

  const product = req.body
  product.img = fileName
  adminHelpers.addProduct(req.body).then((result) => {     
        res.redirect('/admin/products')
    })
  })

/* <---------------------------------------------Edit Product--------------------------------------------------> */

router.get('/edit-product/:id',verifyAdmin,async(req,res) => {
  let category = await adminHelpers.getCategoryDetails();
  adminHelpers.getProductDetails(req.params.id).then(productData => {
    res.render('admin/edit-product',{ productData: productData,category,adminUser: true });
  })
});

router.post('/edit-product/:id',upload.array('image'),async(req,res) => {
  let id = req.params.id;
  let oldImage = await adminHelpers.getProductDetails(id);
  console.log(oldImage);
  const file = req.files
  let filename
  req.body.img = (req.files.length!=0) ? (filename = file.map((file)=> {return file.filename})) : oldImage.img
  adminHelpers.updateProduct(req.params.id,req.body).then(() => {
    res.redirect('/admin/products');
  })
});

/* <---------------------------------------------Delete Product--------------------------------------------------> */

router.get('/delete-product/:id',verifyAdmin,(req,res) => {
  let productId = req.params.id;
  adminHelpers.deleteProduct(productId).then(() => {
    res.redirect('/admin/products')
  })
});

/* <---------------------------------------------Users List. Block/Unblock--------------------------------------------------> */

router.get('/users',verifyAdmin,(req,res) => {
  adminHelpers.getAllUsers().then(usersData => {
    res.render('admin/users',{ adminUser: req.session.admin,admin: true,usersData })
  })
})

router.get('/block-user/:id',verifyAdmin,(req,res) => {
  let userId = req.params.id;
  adminHelpers.blockUser(userId).then(response => {
    if (response) {
      res.redirect('/admin/users')
    }
  })
})

router.get('/unblock-user/:id',verifyAdmin,(req,res) => {
  let userId = req.params.id;
  adminHelpers.unblockUser(userId).then(response => {
    if (response) {
      res.redirect('/admin/users')
    }
  })
})

/* <---------------------------------------------Category List--------------------------------------------------> */

router.get('/category',verifyAdmin,(req,res) => {
  adminHelpers.getCategoryDetails().then((category) => {
    res.render('admin/category',{ category,admin: true })
  })
});

/* <---------------------------------------------Add Category--------------------------------------------------> */

router.get('/add-category',verifyAdmin,(req,res) => {  
  res.render('admin/add-category',{ admin: true,responseErrCat, responseSuCat })
    responseErrCat = ""
    responseSuCat = ""
})

router.post('/add-category',upload.any('image'),(req,res) => {
  const files = req.files
  const file = files.map((file)=>{
    return file
  })
  const fileName = file.map((file)=>{
    return file.filename
  })
  const product = req.body
  product.img = fileName
  adminHelpers.addCategory(req.body).then(response => {
    if(response.categoryFailed){
      responseErrCat = response.categoryFailed
    }else{
      responseSuCat = response.categorySuccess
    }
    res.redirect('/admin/add-category') 
    })
})

/* <---------------------------------------------Delete Category--------------------------------------------------> */

router.get('/delete-category/:id',verifyAdmin,(req,res)=>{
  let categoryId = req.params.id;
  adminHelpers.deleteCategory(categoryId).then(()=>{
    res.redirect('/admin/category')
  })
})

/* <---------------------------------------------Orders List--------------------------------------------------> */

router.get('/order',verifyAdmin,async (req,res) => {
  let orders = await adminHelpers.getAllOrders();
  res.render('admin/order',{ orders, admin: true })
})

router.post('/updateOrderStatus',(req,res) => {
  adminHelpers.updateOrderStatus(req.body).then(() => {
    res.redirect('/admin/order')
  })
})

/* <---------------------------------------------Coupon Management--------------------------------------------------> */

router.get('/manageCoupon', verifyAdmin,async(req,res)=>{
  let coupons = await adminHelpers.getAllCoupons()
  res.render('admin/manageCoupon',{admin:true, coupons, couponErrMssg, couponSuccessMssg})
  couponErrMssg = ""
  couponSuccessMssg = ""
})

router.post('/add-coupon',(req,res)=>{
  adminHelpers.addCoupons(req.body).then((response)=>{
    if (response.couponAlreadyExist){
      couponErrMssg = response.couponAlreadyExist
      res.redirect('/admin/manageCoupon')
    }else{
      couponSuccessMssg = response.couponSuccess
      res.redirect('/admin/manageCoupon')
    }
  })
})

router.get('/delete-coupon/:id',verifyAdmin,(req,res)=>{
  let couponId = req.params.id;
  adminHelpers.removeCoupon(couponId).then(()=>{
    res.redirect('/admin/manageCoupon')
  })
})

/* <---------------------------------------------Sales Report--------------------------------------------------> */

router.get('/sales-report',verifyAdmin,async(req,res)=>{
  let response = await adminHelpers.getTotalSaleGraph()
  let {dailySales,monthlySales,yearlySales} = response;
  let salesReport = await adminHelpers.getSalesReport();
  let {weeklyReport,monthlyReport,yearlyReport} = salesReport
  res.render('admin/sales-report',{ admin: true,dailySales,monthlySales,yearlySales,weeklyReport,monthlyReport,yearlyReport })
})

module.exports = router;

