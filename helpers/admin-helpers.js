var db = require('../config/connection')
var collection = require('../config/collection')
const bcrypt = require('bcrypt')
const { response } = require('express')
var objectId = require('mongodb').ObjectId

module.exports = {
    doVerifySignup: (userData) => {
        return new Promise(async (resolve,reject) => {
            let user = await db.get().collection(collection.USERS_COLLECTION).findOne({ email: userData.email });
            resolve(user);
        })
    },

    getAllProducts: async (limit,startIndex) => {
        return new Promise (async(resolve,reject)=>{
            let products = await db.get().collection(collection.PRODUCTS_COLLECTION).find().limit(limit).skip(startIndex).toArray();
            resolve(products)
        })
    },

    addProduct: (productData) => {
        productData.quantity = parseInt(productData.quantity)
        productData.category = objectId(productData.category)
        return new Promise(async (resolve,reject) => {
            db.get().collection(collection.PRODUCTS_COLLECTION).insertOne(productData).then((data) => {
                console.log(data)
                resolve(data)
            })
        })
    },

    getProductDetails: (productId) => {
        return new Promise((resolve,reject) => {
            db.get().collection(collection.PRODUCTS_COLLECTION).findOne({ _id: objectId(productId) }).then(data => {
                resolve(data)
                console.log(data)
            })
        })
    },

    deleteProduct: (productId) => {
        return new Promise(async (resolve,reject) => {
            let deleteProduct = await db.get().collection(collection.PRODUCTS_COLLECTION).deleteOne({ _id: objectId(productId) })
            resolve(deleteProduct)
        })
    },

    getUserDetails: (userId) => {
        return new Promise((resolve,reject) => {
            db.get().collection(collection.USERS_COLLECTION).findOne({ _id: objectId(userId) }).then(data => {
                resolve(data)
            })
        })
    },

    updateProduct: (productId,product) => {
        return new Promise((resolve,reject) => {
            db.get().collection(collection.PRODUCTS_COLLECTION).updateOne({ _id: objectId(productId) },
                {
                    $set: {
                        name: product.name,
                        category: objectId( product.category ),
                        price: product.price,
                        quantity: parseInt(product.quantity),
                        img: product.img
                    }
                }).then(data => {
                    resolve(data);
                })
        })
    },

    getproductsCountAd:()=>{
        return new Promise(async (resolve,reject) => {
            productsCountAd = await db.get().collection(collection.PRODUCTS_COLLECTION).count()
            resolve(productsCountAd)
        })
    },

    addCategory: (categoryData) => {
        let response = {}
        return new Promise(async (resolve,reject) => {
            let categoryFind = await db.get().collection(collection.CATEGORIES_COLLECTION).findOne({name:categoryData.name})
            if(categoryFind){
                response.categoryFailed = true
                resolve(response)
            }else{
                db.get().collection(collection.CATEGORIES_COLLECTION).insertOne(categoryData).then(response => {
                    response.categorySuccess = true
                    resolve(response);
                })
            }
        })
    },

    getCategoryDetails: () => {
        return new Promise(async (resolve,reject) => {
            let category = await db.get().collection(collection.CATEGORIES_COLLECTION).find().toArray();
            resolve(category)
        })
    },

    deleteCategory:(categoryId)=>{
        return new Promise(async(resolve,reject)=>{
            let deleteCategory = await db.get().collection(collection.CATEGORIES_COLLECTION).deleteOne({_id:objectId(categoryId)})
            resolve(deleteCategory)
        })
    },

    getAllUsers: () => {
        return new Promise(async (resolve,reject) => {
            let user = await db.get().collection(collection.USERS_COLLECTION).find().toArray();
            resolve(user);
        })
    },

    blockUser: (userId) => {
        return new Promise(async (resolve,reject) => {
            let user = await db.get().collection(collection.USERS_COLLECTION).updateOne({ _id: objectId(userId) },
                { $set: { status: false } }
            )
            resolve(user)
        })
    },

    unblockUser: (userId) => {
        return new Promise(async (resolve,reject) => {
            let user = await db.get().collection(collection.USERS_COLLECTION).updateOne({ _id: objectId(userId) },
                { $set: { status: true } }
            )
            resolve(user)
        })
    },

    userStatusChecker: () => {
        return new Promise(async (resolve,reject) => {
            let user = await db.get().collection(collection.USERS_COLLECTION).find({ status: true })
            resolve(user);
        })
    },

    getAllOrders: () => {
        return new Promise(async (resolve,reject) => {
            let orders = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $lookup:{
                        from:collection.ADDRESS_COLLECTION,
                        localField:"addressId",
                        foreignField:"_id",
                        as:"addressDetails"
                    }
                },
                {
                    $unwind:'$addressDetails'
                },
                {
                    $unwind:'$products'
                },
                {
                    $lookup:{
                        from:collection.PRODUCTS_COLLECTION,
                        localField:"products.item",
                        foreignField:"_id",
                        as:"products"
                    }
                },{
                    $unwind:"$products"
                },
                {
                    $group:{
                        _id:'$_id',addressId:{$push:'$addressId'},
                        userId:{$push:'$userId'},
                        paymentMethod:{$push:'$paymentMethod'},
                        totalAmount: { $push:'$totalAmount'},
                        discountedPrice:{$push:'$discountedPrice'},
                        status:{$push:'$status'},
                        date:{$push:'$date'},
                        createdAt: { $push:'$createdAt'},
                        addressDetails: { $push:'$addressDetails'},
                        products:{$push:'$products'}
                    }
                },
                {
                    $project:{
                         _id:1,
                        userId: { $arrayElemAt: ['$userId',0] },
                        paymentMethod: { $arrayElemAt: ['$paymentMethod',0] },
                        totalAmount: { $arrayElemAt: ['$totalAmount',0] },
                        discountedPrice: { $arrayElemAt: ['$discountedPrice',0] },
                        status: { $arrayElemAt: ['$status',0] },
                        date: { $arrayElemAt: ['$date',0] },
                        createdAt: { $arrayElemAt: ['$createdAt',0] },
                        addressDetails: { $arrayElemAt: ['$addressDetails',0] },
                        products:1
                        
                    }
                },
                {
                    $sort: ({'createdAt': -1})
                }
             
            ]).toArray()
            resolve(orders)
        })
        
    },
    getReturnOrders:()=>{
        return new Promise (async(resolve,reject)=>{
            let returnOrder = await db.get().collection(collection.RETURNORDER_COLLECTION).find().toArray()
            resolve(returnOrder)
        })
    },

    getOrderProducts:()=>{
        return new Promise(async(resolve,reject)=>{
            let orderProducts = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $unwind: '$products'
                },
                {
                    $lookup: {
                        from: collection.PRODUCTS_COLLECTION,
                        localField: "products.item",
                        foreignField: "_id",
                        as: "productsDetails"
                    }
                },
                {
                    $unwind: '$productsDetails'
                }
                
            ]).toArray()
            resolve(orderProducts)
        })
    },

    updateOrderStatus: (data) => {
        return new Promise(async (resolve,reject) => {
            if (data.status == 'cancelled') {
                let updateStatus = db.get().collection(collection.ORDER_COLLECTION).updateOne({ _id: objectId(data.orderId),userId: objectId(data.userId) },
                    {
                        $set: { status: data.status,orderCancelled: true }
                    },{ upsert: true }
                )
                resolve(updateStatus)
            }
            let updateStatus = await db.get().collection(collection.ORDER_COLLECTION).updateOne({ _id: objectId(data.orderId),userId: objectId(data.userId) },
                {
                    $set: { status: data.status }
                },{ upsert: true }
            )
            resolve(updateStatus)
        })
    },

    getTotalSaleGraph: () => {
        return new Promise(async (resolve,reject) => {
            let dailySales = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { status: { $nin: ['cancelled'] } }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d",date: "$createdAt" } },
                        total: { $sum: "$totalAmount.grandtotal" }
                    }
                },
                {
                    $sort: {
                        '_id': -1,
                    }
                },
                {
                    $limit: 7
                },
                {
                    $sort: {
                        '_id': 1,
                    }
                }
            ]).toArray()

            let monthlySales = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { status: { $nin: ['cancelled'] } }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m",date: "$createdAt" } },
                        total: { $sum: "$totalAmount.grandtotal" }
                    }
                },
                {
                    $sort: {
                        '_id': -1,
                    }
                },
                {
                    $limit: 1,
                },
                {
                    $sort: {
                        '_id': 1,
                    }
                }
            ]).toArray()

            let yearlySales = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { status: { $nin: ['cancelled'] } }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y",date: "$createdAt" } },
                        total: { $sum: "$totalAmount.grandtotal" }
                    }
                },
                {
                    $sort: {
                        '_id': -1,
                    }
                },
                {
                    $limit: 1,
                },
                {
                    $sort: {
                        '_id': 1,
                    }
                }
            ]).toArray()
            resolve({ dailySales,monthlySales,yearlySales })
        })
    },

    getSalesReport: () => {
        let month = new Date().getMonth() + 1
        let year = new Date().getFullYear()
        return new Promise(async (resolve,reject) => {
            let weeklyReport = await db.get().collection(collection.ORDER_COLLECTION).find({
                createdAt: {
                    $gte: new Date(new Date() - 7 * 60 * 60 * 24 * 1000)
                }
            }).toArray()
            let monthlyReport = await db.get().collection(collection.ORDER_COLLECTION).find({
                "$expr": { "$eq": [{ "$month": "$createdAt" },month] }
            }).toArray()

            let yearlyReport = await db.get().collection(collection.ORDER_COLLECTION).find({
                "$expr": { "$eq": [{ "$year": "$createdAt" },year] }
            }).toArray()
            resolve({ weeklyReport,monthlyReport,yearlyReport })
        })
    },

    getPaymentGraph: () => {
        return new Promise(async (resolve,reject) => {
            let totalPayments = await db.get().collection(collection.ORDER_COLLECTION).countDocuments({
                status: { $nin: ['cancelled'] }
            })

            let totalCOD = await db.get().collection(collection.ORDER_COLLECTION).countDocuments({
                paymentMethod: 'COD',status: { $nin: ['cancelled','pending'] }
            })

            let totalUPI = await db.get().collection(collection.ORDER_COLLECTION).countDocuments({
                paymentMethod: 'UPI',status: { $nin: ['cancelled','pending'] }
            })

            let totalPaypal = await db.get().collection(collection.ORDER_COLLECTION).countDocuments({
                paymentMethod: 'paypal',status: { $nin: ['cancelled','pending'] }
            })

            let percentageCOD = Math.round(totalCOD / totalPayments * 100);
            let percentageUPI = Math.round(totalUPI / totalPayments * 100);
            let percentagePaypal = Math.round(totalPaypal / totalPayments * 100);
    
            resolve({ percentageCOD,percentageUPI,percentagePaypal })
        })
    },

    addCoupons:(couponData)=>{
        let discount = parseInt(couponData.discount)
        couponData.discount = discount
        let response = {}
        return new Promise(async(resolve,reject)=>{
            let alreadyExist = await db.get().collection(collection.COUPON_COLLECTION).findOne({couponCode:couponData.couponCode})
            if(alreadyExist){
                response.couponAlreadyExist = "Coupon already exists"
                resolve(response)
            }else{
                db.get().collection(collection.COUPON_COLLECTION).insertOne(couponData).then(()=>{
                    response.couponSuccess = "Coupon added successfully"
                    resolve(response)
                })
            }
        })
    },

    getAllCoupons:()=>{
        return new Promise(async(resolve,reject)=>{
            let allCoupons = await db.get().collection(collection.COUPON_COLLECTION).find().toArray()
            resolve(allCoupons)
        })
    },

    removeCoupon:(couponId)=>{
        return new Promise(async(resolve,reject)=>{
            let deleteCoupon = await db.get().collection(collection.COUPON_COLLECTION).deleteOne({_id:objectId(couponId)})
            resolve(deleteCoupon)
        })
    }
}


