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


// In your app.js or a specific routes file
app.get("/appointment", async (req, res) => {
    try {
        const appointments = await Appointment.find();
        res.render("appointment", { appointments });
    } catch (error) {
        res.status(500).send("Error loading appointments");
    }
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
        const appointments = await Appointment.find(); // Fetch all to find the index
        res.json({
            success: true,
            appointmentIndex: appointments.length, // Assuming you want the new appointment's index to be the total count
            customerName: newAppointment.customerName,
            dateTime: newAppointment.dateTime,
            contactNumber: newAppointment.contactNumber,
            id: newAppointment._id // Make sure to send the new appointment ID for further actions
        });
    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).json({ success: false });
    }
});


// In your app.js or routes file
app.post("/update-appointment", async (req, res) => {
    const { id, customerName, contactNumber, dateTime } = req.body;
    try {
        await Appointment.findByIdAndUpdate(id, {
            customerName,
            contactNumber,
            dateTime: new Date(dateTime)
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Failed to update appointment:", error);
        res.status(500).json({ success: false });
    }
});

app.post("/delete-appointment", async (req, res) => {
    try {
        await Appointment.findByIdAndDelete(req.body.id);
        res.redirect("/appointment");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get("/client", (req, res) => {
    res.render("client");
});


app.post('/search-customer', async (req, res) => {
    try {
        const { customerName, customerNumber } = req.body;
        // Create a case-insensitive regular expression for customer name
        const customerNameRegex = new RegExp('^' + customerName + '$', 'i');

        const customerData = await Fetch.find({
            customer_name: customerNameRegex,  // Use regex for case-insensitive search
            customer_number: customerNumber
        });

        if (customerData.length > 0) {
            const totalSpent = customerData.reduce((sum, record) => sum + record.services.reduce((serviceSum, service) => serviceSum + service.price, 0), 0);
            const services = customerData.flatMap(record => record.services.map(service => service.name));
            const uniqueServices = [...new Set(services)];

            res.json({
                success: true,
                visits: customerData.length,
                totalSpent,
                services: uniqueServices
            });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        console.error('Error retrieving customer data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});



app.listen(port, () => {
    console.log(`Server is running on ${port}`);
});
