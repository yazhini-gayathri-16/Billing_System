const express = require("express");
const path = require("path");
const ejs = require("ejs");


const Fetch = require("./connection");
require("./connection");

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended:true}));

const port = process.env.PORT || 3000;
app.set('view engine', 'ejs');
// Serve static files (for CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

app.get("/",(req,res) => {
    res.render("index");
})

app.post("/bill",async (req,res) =>{
    try {
        
        const customer_name =req.body.customer_name;
        const customer_number = req.body.customer_number;
        const date = req.body.date;
        const time = req.body.time;
        console.log(customer_name,customer_number, date, time);

        const user = await Fetch.create({customer_name,customer_number,date,time});
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



