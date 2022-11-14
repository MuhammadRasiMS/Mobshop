function addToCart(proId) {
    console.log('proId:');
    console.log(proId);
    $.ajax({
        url: '/add-to-cart/' + proId,
        method: 'get',
        success: (response) => {
            if (response.status) {
                let count = $('#cart-count').html()
                count = parseInt(count) + 1
                $("#cart-count").html(count)
            }
        }
    })
}

	function addToWishList(proId){
        console.log(proId);
    document.getElementById('wishlist').style.color="brown"
    $.ajax({
        url:'/addToWishList',
        data:{
            product:proId,
        },
        method:'post',
        success:(response)=>{
            if(response.login){
                location.reload()
            }else{
                location.href='/login'
            }
        }
    })
}


function removeWishListProduct(proId,wishListId){
    console.log('proId:');
    console.log(proId);
    console.log('wishListId:');
    console.log(wishListId);
    if(confirm("Are you sure")){
        $.ajax({
            url:'/delete-wishlist-product',
            data:{
                product:proId,
                wishList:wishListId
            },
            method:'post',
            success:(response)=>{
                
                location.reload()
            }
        })
    }
}

