const express = require("express");
const Fetch = require("./connection");
require("./connection");

const app = express();

app.use(express.json());
app.set(express.urlencoded({extended:false}));

const port = process.env.PORT || 3000;

app.get("/",(req,res) => {
    res.sendFile(__dirname+"/index.html");
})

app.post("/bill",async (req,res) =>{
    try {
        
        const customer_name = req.body.customer_name;
        const customer_number = req.body.customer_number;
        console.log(customer_name,customer_number);

        const user = await Fetch.create({customer_name,customer_number});
        if(user){
            res.status(200).redirect('/');
        }else{
            res.status(400);
        }

    } catch (err) {
        console.log(err);
    }
}) 


app.listen(port, () => {
    console.log(`server is running on ${port} `);
    
});



