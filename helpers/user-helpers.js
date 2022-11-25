var db = require('../config/connection')
var collection = require('../config/collection')
const bcrypt = require('bcrypt')
var objectId = require('mongodb').ObjectId
const Razorpay = require('razorpay')
const { receiveMessageOnPort } = require('node:worker_threads')
const { ReturnDocument, ObjectId } = require('mongodb')
const { resolve } = require('node:path')
const { order } = require('paypal-rest-sdk')
const { response } = require('../app')

require("dotenv").config();

var instance = new Razorpay({
    key_id: process.env.KEYID,
    key_secret: process.env.KEYSECRET,
});

module.exports = {

    doSignup: (userData) => {
        return new Promise(async (resolve,reject) => {
            userData.password = await bcrypt.hash(userData.password,10);
            userData.wallet = parseInt(0);
            db.get().collection(collection.USERS_COLLECTION).insertOne(userData).then((data) => {
                resolve(data)
            })
        })
    },

    doLogin: (userData) => {
        return new Promise(async (resolve,reject) => {
            let response = {};
            let user = await db.get().collection(collection.USERS_COLLECTION).findOne({ email: userData.email })
            if (user) {
                bcrypt.compare(userData.password,user.password).then((status) => {
                    if (status) {
                        console.log("Login success");
                        response.user = user;
                        response.status = true;
                        console.log(response)
                        resolve(response);
                    } else {
                        console.log("user is blocked");
                        response.status = false
                        resolve(response)
                    }
                })
            }else{
                console.log("invalid user");
                response.status = false
                resolve(response)
            }
        })
    },

    doOtpLogin: (userData) => {
        return new Promise(async (resolve,reject) => {
            let response = {}
            let user = await db.get().collection(collection.USERS_COLLECTION).findOne({ phoneNumber: userData.phoneNumber })
            if (user) {
                console.log("otp login successful");
                response.user = user;
                response.status = true;
                resolve(response);
            } else {
                console.log("otp login failed");
                resolve({ status: false })
            }
        })
    },

    doOtpVerify: (userData) => {
        return new Promise(async (resolve,reject) => {
            let user = await db.get().collection(collection.USERS_COLLECTION).find();
        })
    },

    doVerifySignup: (userData) => {
        return new Promise(async (resolve,reject) => {
            let user = await db.get().collection(collection.USERS_COLLECTION).findOne({ email: userData.email });
            resolve(user);
        })
    },

    getAllProducts: () => {
        return new Promise(async (resolve,reject) => {
            let product = await db.get().collection(collection.PRODUCTS_COLLECTION).aggregate([
                {
                    $lookup:{
                        from: 'category',
                        localField: 'category',
                        foreignField: '_id',
                        as: 'category'
                    }
                },
                {
                    $unwind: '$category'
                }
            ]).
            toArray();
            resolve(product);
        })
    },

    getProductDetails: (productId) => {
        return new Promise(async (resolve,reject) => {
            let product = await db.get().collection(collection.PRODUCTS_COLLECTION).findOne({ _id: objectId(productId) })
            resolve(product);
        })
    },


    getUserOrderDetail: (userId,orderId) => {
        return new Promise(async (resolve,reject) => {
            let orderdetail = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { _id: objectId(orderId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity',
                        status: '$products.status',
                        discountedPrice: 1,
                        totalAmount: 1

                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        discountedPrice: 1,totalAmount: 1,status: 1,item: 1,quantity: 1,product: { $arrayElemAt: ['$product',0] }
                    }
                },
            ]).toArray()
            resolve(orderdetail)
        })
    },

    getCategoryDetails: () => {
        return new Promise(async (resolve,reject) => {
            let category = await db.get().collection(collection.CATEGORIES_COLLECTION).find().toArray();
            resolve(category);
        })
    },

    getUsertDetails: (userId) => {
        return new Promise(async (resolve,reject) => {
            let user = await db.get().collection(collection.USERS_COLLECTION).findOne({ _id: objectId(userId) })
            resolve(user);
        })
    },

    addToCart: (productId,userId) => {
        let proObj = {
            item: objectId(productId),
            quantity: 1
        }
        return new Promise(async (resolve,reject) => {
            let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: objectId(userId) })
            if (userCart) {
                let proExist = userCart.products.findIndex(product => product.item == productId)
                if (proExist != -1) {
                    db.get().collection(collection.CART_COLLECTION)
                        .updateOne({ user: objectId(userId),'products.item': objectId(productId) },
                            {
                                $inc: { 'products.$.quantity': 1 }
                            }
                        ).then(() => {
                            resolve()
                        })
                } else {
                    db.get().collection(collection.CART_COLLECTION)
                        .updateOne({ user: objectId(userId) },
                            {
                                $push: { products: proObj }
                            }
                        ).then((response) => {
                            resolve(response)
                        })
                }
            } else {
                let cartObj = {
                    user: objectId(userId),
                    products: [proObj]
                }
                db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response) => {
                    resolve(response)
                })
            }
        })
    },

    getCartProducts: (userId) => {
        return new Promise(async (resolve,reject) => {
            let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: objectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCTS_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,quantity: 1,product: { $arrayElemAt: ['$product',0] }
                    }
                }
            ]).toArray()
            resolve(cartItems)
        })
    },

    getCartCount: (userId) => {
        return new Promise(async (resolve,reject) => {
            let count = 0
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: objectId(userId) })
            if (cart) {
                count = cart.products.length
            }
            resolve(count)
        })
    },

    changeProductQuantity: (details) => {
        details.count = parseInt(details.count)
        details.quantity = parseInt(details.quantity)
        return new Promise((resolve,reject) => {
            if (details.count == -1 && details.quantity == 1) {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne({ _id: objectId(details.cart) },
                        {
                            $pull: { products: { item: objectId(details.product) } }
                        }
                    ).then((response) => {
                        resolve({ removeProduct: true })
                    })
            } else {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne({ _id: objectId(details.cart),'products.item': objectId(details.product) },
                        {
                            $inc: { 'products.$.quantity': details.count }
                        }
                    ).then((response) => {
                        resolve({ status: true })
                    })
            }
        })
    },

    removeCart: (productId,userId) => {
        return new Promise((resolve,reject) => {
            db.get().collection(collection.CART_COLLECTION).updateOne({ user: objectId(userId),'products.item': objectId(productId) },
                {
                    $pull: { products: { item: objectId(productId) } }
                }
            ).then(() => {
                resolve({ removeCart: true })
            })
        })
    },

    deleteCoupon:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            let user = await db.get().collection(collection.USERS_COLLECTION).findOne({_id:objectId(userId)})
            let couponId = user.couponId
            await db.get().collection(collection.APPLIEDCOUPONS_COLLECTION).deleteOne({userId:objectId(userId), couponId: objectId(couponId)})
            resolve()
        })
    },

    getTotalAmount: (userId) => {
        return new Promise((resolve,reject) => {
            db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: objectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCTS_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1,quantity: 1,product: { $arrayElemAt: ['$product',0] }
                    }
                },
                {
                    $addFields: {
                        convertPrice: { $toInt: "$product.price" }
                    }
                },
                {
                    $project: {
                        total: { $multiply: ['$quantity','$convertPrice'] },item: 1,quantity: 1,product: 1
                    }
                },
                {
                    $group: {
                        _id: null,
                        grandtotal: { $sum: '$total' }
                    }
                }
            ]).toArray().then((grandtotal) => {     
                resolve(grandtotal[0])
            })
        })
    },

    placeOrder: (order,products,total) => {
        return new Promise((resolve,reject) => {
            let status = order.paymentMethod === 'COD' ? 'placed' : 'pending'
            let orderObj = {
                addressId: objectId(order.addressId),
                userId: objectId(order.userId),
                paymentMethod: order.paymentMethod,
                products: products,
                totalAmount: total,
                discountedPrice: order.discountedPrice,
                status: status,
                date: new Date().toISOString().slice(0,10),
                createdAt: new Date()
            }
            db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response) => {
                resolve(response.insertedId)
            })
        })
    },

    getCartProductList: (userId) => {
        return new Promise(async (resolve,reject) => {
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: objectId(userId) })
            if(cart!=null){
                resolve(cart.products)
            }else{
                resolve()
            }
        })
    },

    getUserOrders: (userId) => {
        return new Promise(async (resolve,reject) => {
            let orders = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { userId: objectId(userId) }
                },    
                {
                    $lookup:{
                        from: collection.ADDRESS_COLLECTION,
                        localField: 'addressId',
                        foreignField: '_id',
                        as: 'addressDetails'
                    }
                },
                {
                    $unwind:'$addressDetails'
                },
                {
                    $sort: ({ 'createdAt': -1 })
                }
            ]).toArray()
            resolve(orders)
        })
    },
   
    getOrderProducts: (orderId) => {
        return new Promise(async (resolve,reject) => {
            let orderItems = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { _id: objectId(orderId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        status:1,
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCTS_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        status: 1,
                        item: 1,quantity: 1,product: { $arrayElemAt: ['$product',0] }
                    }
                }
            ]).toArray()
            resolve(orderItems)
        })
    },

    getOrderStatus: (orderId)=>{
        return new Promise(async(resolve,reject)=>{
            let order = await db.get().collection(collection.ORDER_COLLECTION).findOne({ _id: objectId(orderId) })
            resolve(order)
        })
    },

    cancelOrder: (orderId) => {
        return new Promise(async (resolve,reject) => {
            let order = await db.get().collection(collection.ORDER_COLLECTION).updateOne({ _id: objectId(orderId) },
                {
                    $set: { status: 'Cancelled',orderCancelled: true }
                },{ upsert: true }
            )
            resolve(order)
        })
    },

    getOrdersCount: () => {
        return new Promise(async (resolve,reject) => {
            ordersCount = await db.get().collection(collection.ORDER_COLLECTION).count()
            resolve(ordersCount)
        })
    },

    addAddress: (addressDetails,userId) => {
        let details = {
            userId: objectId(userId),
            firstName: addressDetails.firstName,
            lastName: addressDetails.lastName,
            country: addressDetails.country,
            address: addressDetails.address,
            city: addressDetails.city,
            state: addressDetails.state,
            pincode: addressDetails.pincode,
            phone: addressDetails.phone,
            email: addressDetails.email
        }
        return new Promise(async (resolve,reject) => {
            let address = await db.get().collection(collection.ADDRESS_COLLECTION).insertOne(details);
            resolve(address);
        })
    },

    getUserAddress: (userId) => {
        return new Promise(async (resolve,reject) => {
            let address = await db.get().collection(collection.ADDRESS_COLLECTION).find({ userId: objectId(userId) }).toArray()
            resolve(address);
        })
    },

    deleteShipAddress:(addressId)=>{
        return new Promise (async(resolve,reject)=>{
            let deleteShipAddr = await db.get().collection(collection.ADDRESS_COLLECTION).deleteOne({_id:objectId(addressId)})
            resolve(deleteShipAddr)
        })
    },

    generateRazorpay: (orderId,total) => {
        return new Promise((resolve,reject) => {
            var options = {
                amount: total.grandtotal*10,
                currency: "INR",
                receipt: "" + orderId
            };
            instance.orders.create(options,function (err,order) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("New order :",order);
                    resolve(order)
                }
            })
        })
    },

    verifyPayment: (details) => {
        return new Promise(async (resolve,reject) => {
            const { createHmac } = await import('node:crypto');
            let hmac = createHmac('sha256','pvtCC4EOu3h7fwc7U2EkHaz8');
            hmac.update(details['payment[razorpay_order_id]'] + '|' + details['payment[razorpay_payment_id]']);
            hmac = hmac.digest('hex')
            if (hmac == details['payment[razorpay_signature]']) {
                resolve()
            } else {
                reject()
            }
        })
    },

    changePaymentStatus: (orderId) => {
        return new Promise((resolve,reject) => {
            db.get().collection(collection.ORDER_COLLECTION)
                .updateOne({ _id: objectId(orderId) },
                    {
                        $set: {
                            status: 'placed'
                        }
                    }
                ).then(() => {
                    resolve()
                })
        })
    },

    getOrderProductQuantity:(orderId)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {$match:{_id:objectId(orderId)}},
            {
                $unwind:'$products'
            },
            {
                $project:{
                    productId:"$products.item",
                    quantity:"$products.quantity"      
                }
            }
            ]).toArray().then((response)=>{
                resolve(response)
            })
        })
    },

    stockDecrease:({productId,quantity})=>{
        return new Promise(async(resolve,reject)=>{
            quantity = parseInt(quantity)
            db.get().collection(collection.PRODUCTS_COLLECTION).updateOne({_id:objectId(productId)},
            {
                $inc: {quantity: -quantity}
            }
            )
        })
    },

    stockIncrease: ({productId,quantity})=>{
        return new Promise(async (resolve,reject) => {
            db.get().collection(collection.PRODUCTS_COLLECTION).updateOne({ _id: objectId(productId) },
                {
                    $inc: { quantity: +quantity }
                }
            )
        })
    },

    addToWishList:(products,userId)=>{
        let productObj= {
            item: objectId(products.product)
        }
        return new Promise(async(resolve,reject)=>{
            let userCart=await db.get().collection(collection.WISHLIST_COLLECTION).findOne({userId:objectId(userId)})
            if (userCart){
                let productExist = userCart.products.findIndex(product=> product.item==products.product)
                if (productExist !=-1){
                    db.get().collection(collection.WISHLIST_COLLECTION)
                    .updateOne({userId:objectId(userId),'product.item':objectId(products.product)},
                    
                    {
                        $addToSet:{products:products.product}
                    }
                    ).then(()=>{
                        resolve()
                    })
                }else{
                    db.get().collection(collection.WISHLIST_COLLECTION)
                    .updateOne({userId:objectId(userId)},
                    {
                        $push:{products:productObj}
                    }
                    ).then(()=>{
                        resolve()
                    })
                }
            }else{
              let wishListObj={
                    userId:objectId(userId),
                    products:[productObj]
                }
                db.get().collection(collection.WISHLIST_COLLECTION).insertOne(wishListObj).then(()=>{
                    resolve()
                })
            }
        })
    },

    getWishListProducts:(userId)=>{
        let wishListStatus={}
        return new Promise(async(resolve,reject)=>{
            let wishListFind = await db.get().collection(collection.WISHLIST_COLLECTION).findOne({userId:objectId(userId)})
            if(wishListFind){
                db.get().collection(collection.WISHLIST_COLLECTION).aggregate([
                    {
                        $match:{userId:objectId(userId)}
                    },
                    {
                        $unwind:'$products'
                    },
                    {
                        $project:{
                            item:'$products.item'
                        }
                    },
                    {
                        $lookup:{
                            from:collection.PRODUCTS_COLLECTION,
                            localField:'item',
                            foreignField:'_id',
                            as:'product'
                        }
                    },
                    {
                        $unwind:'$product'
                    },
                ]).toArray().then((response)=>{ 
                    resolve(response)
                })
            }
            else{
                wishListStatus.noItem = true;
                wishListStatus.noWishListMessage = "No items in Wishlist"
                resolve(wishListStatus)
            }
        })
    },

    removeWishListProduct:({product,wishList})=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.WISHLIST_COLLECTION)
            .updateOne({_id:objectId(wishList)},{$pull:{products: {item: objectId(product)}}
        }).then((response)=>{
            resolve(response)
        })
        })
    },

    getWishListCount:(userId)=>{
        return new Promise((resolve,reject)=>{
            let count = 0
            db.get().collection(collection.WISHLIST_COLLECTION).findOne({userId:objectId(userId)}).then((wishList)=>{
                console.log(wishList);
                if(wishList){
                    count = wishList.products.length
                }
                if(count==0){
                    resolve()
                }else{
                    resolve(count)
                }
            })
        })
    },

    applyCoupon:({code},total,userId)=>{
        let response = {}
        let d = new Date()
                let month = '' + (d.getMonth() + 1)
                let day = '' + d.getDate()
                let year = d.getFullYear()

                if (month.length < 2)
                    month = '0' + month;
                if(day.length < 2)
                    day = '0' + day;
                    let time = [year, month, day].join('-')
        return new Promise(async(resolve,reject)=>{
            let couponFind = await db.get().collection(collection.COUPON_COLLECTION).findOne({couponCode:code})
            if(couponFind){   
                response.couponFind = true
                let currentDate = time
                if(currentDate>couponFind.Expirydate){    
                    response.expiredCoupon = true
                    response.couponExpired = "Sorry, Coupon is expired"
                    resolve(response)
                }else{ 
                    response.expiredCoupon = false
                    let couponAlreadyApplied = await db.get().collection(collection.APPLIEDCOUPONS_COLLECTION).findOne({userId:objectId(userId), couponId:couponFind._id})
                    if(couponAlreadyApplied){  
                        response.appliedCoupon = true
                        response.couponApplied = "Coupon already applied"
                        resolve(response)
                    }else{
                        response.appliedCoupon = false
                        response.couponAppliedSuccess = "Coupon applied successfully"
                        let couponDiscountPercentage = couponFind.discount 
                        let discountPrice = (couponDiscountPercentage/100)*total
                        let totalPriceAfterOffer = total - discountPrice
                        response.totalPriceAfterOffer = totalPriceAfterOffer
                        response.discountPrice = discountPrice
                            appliedCouponObj = {
                                userId:objectId(userId),
                                couponId:couponFind._id
                            }
                            db.get().collection(collection.APPLIEDCOUPONS_COLLECTION).insertOne(appliedCouponObj)
                        db.get().collection(collection.USERS_COLLECTION).updateOne({ _id: objectId(userId) },{ $set: { couponId: couponFind._id }})
                        resolve(response)
                    }
                }
            }else{
                response.couponFind = false
                response.couponNotFound = "Coupon not found"
                resolve(response)
            }
        })
    },

    getCartDiscount:(total,userId)=>{
        let tot = parseInt(total)
        return new Promise (async(resolve,reject)=>{
           let discountPrice= await db.get().collection(collection.CART_COLLECTION).aggregate(
                [
                    {
                        $match:{user:objectId(userId)}
                    },
                    {
                        $lookup:{
                                from:collection.USERS_COLLECTION,
                                localField:"user",
                                foreignField:"_id",
                                as:"userdetails"
                        }
                    },
                    {
                        $project:{userDetails:{$arrayElemAt:["$userdetails",0]}}
                    },
                    {
                        $lookup:{
                            from:collection.COUPON_COLLECTION,
                            localField:"userDetails.couponId",
                            foreignField:"_id",
                            as:"couponDetails"
                        }
                    },
                    {
                        $project:{couponDetails:{$arrayElemAt:["$couponDetails",0]},userDetails:1}
                    },
                    {
                        $project:{
                            discount:{$round:[{$multiply:[{$divide:["$couponDetails.discount",100]},tot]},0]},
                            userDetails:1,
                            couponDetails:1,
                            
                        }
                    },
                   {
                       $project: {
                           discountedPrice: {$subtract:[tot,'$discount'] },
                           userDetails: 1,
                           couponDetails: 1
                       }
                   }
                    
                ]
            ).toArray()
            resolve(discountPrice)
        })
    },

    removeCoupon:(userId)=>{
        return new Promise (async(resolve,reject)=>{
            db.get().collection(collection.USERS_COLLECTION).findOne({_id:ObjectId(userId)}).then((userData)=>{
                db.get().collection(collection.USERS_COLLECTION).updateOne({ _id: ObjectId(userId) },
                    {
                        $unset: {
                            couponId: userData.couponId
                        }
                    }
                ).then(() => {
                    resolve()
                })
            })
        })
    },

    updateOrderStatus:(data)=>{
        return new Promise (async(resolve,reject)=>{
           let updateStatus =  await db.get().collection(collection.ORDER_COLLECTION).updateOne({_id:objectId(data.orderId),userId:ObjectId(data.userId)},
                {
                    $set : {status:data.status}
                }
            )
            resolve(updateStatus)
        })
    },

    returnOrder:(orderData)=>{
        return new Promise (async(resolve,reject)=>{
            let order = await db.get().collection(collection.RETURNORDER_COLLECTION).insertOne(orderData);
            resolve(order)
        })
    },


    filterProducts:(filterItems)=>{
        return new Promise(async(resolve,reject)=>{
            if (Array.isArray(filterItems)){
                filterItems.forEach(convert);
                function convert(item,index,arr){
                    arr[index] = objectId(item)
                }
                let filter = await db.get().collection(collection.PRODUCTS_COLLECTION).find({category:
                    {
                        $in:filterItems
                    }
                }).toArray()
                resolve(filter)
            }else{
                let filterData = objectId(filterItems)
                let filter = await db.get().collection(collection.PRODUCTS_COLLECTION).find({
                    category:{$in:[filterData]}
                }).toArray()
                resolve(filter)
            }
        })
    },

    getProductsCount:()=>{
        return new Promise (async(resolve,reject)=>{
            productsCount = await db.get().collection(collection.PRODUCTS_COLLECTION).count()
            resolve(productsCount)
        })
    },

    getPaginatedProducts: (limit,startIndex) => {
        return new Promise(async (resolve,reject) => {
            let product = await db.get().collection(collection.PRODUCTS_COLLECTION).find().limit(limit).skip(startIndex).toArray();
            resolve(product);
        })
    },

    searchProduct:(payload)=>{
        return new Promise(async(resolve,reject)=>{
            let search = await db.get().collection(collection.PRODUCTS_COLLECTION).find({name: {$regex: new RegExp('^' + payload + '.*', 'i')}
        }).toArray();
        search = search.slice(0, 10)
        resolve(search)
        })
    },

    getInvoice:(orderId)=>{
        return new Promise(async(resolve,reject)=>{
            let ordreItem = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: {_id: objectId(orderId)}
                },
                {
                    $unwind: '$products'
                },
                {
                    $lookup:{
                        from: collection.ADDRESS_COLLECTION,
                        localField: 'addressId',
                        foreignField: '_id',
                        as: 'address'
                    }
                },
                {
                    $unwind: '$address'
                }
            ]).toArray()
            resolve(ordreItem[0])
        })
    },

    walletAmountCheckForUser: (userId) => {
        return new Promise(async (resolve,reject) => {
            let user = await db.get().collection('user').findOne({ _id: objectId(userId) })
            walletAmount = Math.round(user.wallet)
            resolve(walletAmount)
        })
    },

    walletAmountCheck: (userId, totalprice) => {
        return new Promise(async(resolve,reject)=>{
            let user = await db.get().collection(collection.USERS_COLLECTION).findOne({_id: objectId(userId)})
            walletAmount = user.wallet
            if(walletAmount >= totalprice.grandtotal){
                resolve(walletAmount)
            }else{
                resolve(null)
            }
        })
    },

    walletAmountReduce: (userId, totalAmount)=>{
        return new Promise(async(resolve,reject)=>{
            let returnPayment = await db.get().collection(collection.USERS_COLLECTION).updateOne({_id: objectId(userId)},{
                $inc: {"wallet": -totalAmount.grandtotal}
            })
            let user = await db.get().collection(collection.USERS_COLLECTION).findOne({_id:objectId(userId)})
            resolve()
        })
    },

    deleteCart:(userId)=>{
        return new Promise(async(resolve,reject)=>{
            await db.get().collection(collection.CART_COLLECTION).deleteOne({ user: objectId(userId) })
            resolve()
        })
    }
   
}

