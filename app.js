const express = require("express");
const mongoose = require("mongoose");
const Fetch = require("./models/fetch"); // Ensure this points to the file where Fetch is defined
const Menu = require("./models/menu");
const Appointment = require('./models/appointment');

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

// Add this endpoint in your app.js or server.js
app.get("/api/services", async (req, res) => {
    try {
        const services = await Menu.find({}, 'serviceName price -_id'); // Fetch only serviceName and price, exclude _id
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get("/appointment", (req, res) => {
    res.render("appointment");
});


app.post('/appointments', async (req, res) => {
    try {
        const { customerName, dateTime, contactNumber, serviceType, specialNeeds } = req.body;
        const newAppointment = new Appointment({
            customerName,
            dateTime: new Date(dateTime),
            contactNumber,
            serviceType,
            specialNeeds
        });
        await newAppointment.save();
        res.send('Appointment booked successfully!');
    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).send('Failed to book appointment');
    }
});


app.listen(port, () => {
    console.log(`Server is running on ${port}`);
});
