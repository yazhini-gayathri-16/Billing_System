const express = require("express");
const mongoose = require("mongoose");
const Fetch = require("./models/fetch"); // Ensure this points to the file where Fetch is defined
const Menu = require("./models/menu");

require("./connection");

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const port = process.env.PORT || 3000;
app.set('view engine', 'ejs');
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.render("index");
});

app.post("/bill", async (req, res) => {
    try {
        const { customer_name, customer_number, date, time } = req.body;
        let services = [];
        let index = 1;
        console.log(req.body);
        // Loop until there's no service or price with the next index
        while(req.body[`services${index}`] && req.body[`prices${index}`]) {
            services.push({
                name: req.body[`services${index}`],
                price: parseFloat(req.body[`prices${index}`]) // Ensure the price is a number
            });
            index++;
            
        }
        console.log(services);

        const user = await Fetch.create({
            customer_name,
            customer_number,
            date,
            time,
            services // Assuming the schema expects an array of service objects
        });

        if (user) {
            res.status(200).redirect('/');
        } else {
            res.status(400).send("Failed to create receipt");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});



// Route to render the menu management page
app.get("/menu-management", async (req, res) => {
    try {
        const services = await Menu.find();
        res.render("menu", { services });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Route to add a new service
app.post("/add-service", async (req, res) => {
    try {
        const newService = new Menu(req.body);
        await newService.save();
        res.redirect("/menu-management");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Route to update an existing service
app.post("/edit-service", async (req, res) => {
    const { id, serviceName, price } = req.body;
    try {
        await Menu.findByIdAndUpdate(id, { serviceName, price });
        res.redirect("/menu-management");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Route to delete a service
app.post("/delete-service", async (req, res) => {
    try {
        await Menu.findByIdAndDelete(req.body.id);
        res.redirect("/menu-management");
    } catch (error) {
        res.status(500).send(error.message);
    }
});


app.listen(port, () => {
    console.log(`Server is running on ${port}`);
});
