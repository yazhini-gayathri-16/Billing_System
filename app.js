const express = require("express");
const cors = require('cors');
const mongoose = require("mongoose");
const Signup = require("./models/signup");
const Fetch = require("./models/fetch"); // Ensure this points to the file where Fetch is defined
const Menu = require("./models/menu");
const Appointment = require('./models/appointment');
const Membership = require('./models/membership');
const Staff = require('./models/staff');

require("./connection");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const port = process.env.PORT || 3000;
app.set('view engine', 'ejs');
app.use(express.static("public"));

// In your app.js or server.js file
app.get("/", async (req, res) => {
    try {
        // Fetch all staff members from the database
        const staffMembers = await Staff.find({});
        // Pass staff members to the template
        res.render("index", { staffMembers });
    } catch (error) {
        console.error("Failed to fetch staff members:", error);
        res.status(500).send("Error loading the page.");
    }
});


app.post("/bill", async (req, res) => {
    try {
        const { customer_name, customer_number, date, time, membershipID, specialist, subtotal } = req.body;
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
            membershipID, 
            specialist,
            subtotal,
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

app.post("/bill", async (req, res) => {
    try {
        const { customer_name, customer_number, specialist } = req.body;
        console.log("Selected Specialist ID:", specialist);
        // Process the form submission, including the selected specialist
        // Redirect or send a response back to the client
        res.status(200).redirect('/');
    } catch (error) {
        console.error("Error processing the bill:", error);
        res.status(500).send("Failed to process the bill.");
    }
});

app.post('/validate-membership', async (req, res) => {
    try {
        const { membershipID } = req.body;
        const membership = await Membership.findOne({ membershipID });

        if (!membership) {
            return res.status(404).json({ message: 'Wrong membership ID' });
        }

        if (new Date(membership.validTillDate) < new Date()) {
            return res.status(200).json({ message: 'Membership ID expired' });
        }

        res.status(200).json({ message: 'Valid membership ID' });
    } catch (error) {
        console.error('Error validating membership:', error);
        res.status(500).json({ message: 'Error validating membership ID' });
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
        const { serviceName, regularPrice, membershipPrice } = req.body;
        const newService = new Menu({ serviceName, regularPrice, membershipPrice });
        await newService.save();
        res.redirect("/menu-management");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Route to update an existing service
app.post("/edit-service", async (req, res) => {
    const { id, serviceName, regularPrice, membershipPrice } = req.body;
    try {
        await Menu.findByIdAndUpdate(id, { serviceName, regularPrice, membershipPrice });
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

app.get("/menu-display", async (req, res) => {
    try {
        const services = await Menu.find();
        res.render("menuview", { services });  // Ensure this points to the correct ejs file for display
    } catch (error) {
        console.error("Error fetching services:", error);
        res.status(500).send("Error loading the service menu.");
    }
});


// Add this endpoint in your app.js or server.js
app.get("/api/services", async (req, res) => {
    try {
        const services = await Menu.find({}, 'serviceName regularPrice membershipPrice -_id');
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// In your app.js or a specific routes file
app.get("/appointment", async (req, res) => {
    try {
        const staffMembers = await Staff.find({});
        const appointments = await Appointment.find();
        res.render("appointment", { appointments, staffMembers });
    } catch (error) {
        console.error("Failed to fetch staff members:", error);
        res.status(500).send("Error loading appointments");
    }
});


app.post('/appointments', async (req, res) => {
    try {
        const { customerName, dateTime, contactNumber, specialist, serviceType, specialNeeds } = req.body;

        const newAppointment = new Appointment({
            customerName,
            dateTime: new Date(dateTime),
            contactNumber,
            specialist,
            serviceType,
            specialNeeds
        });

        await newAppointment.save();
        const appointments = await Appointment.find();
        res.json({
            success: true,
            appointmentIndex: appointments.length,
            customerName: newAppointment.customerName,
            dateTime: newAppointment.dateTime,
            contactNumber: newAppointment.contactNumber,
            id: newAppointment._id
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

app.post('/add-membership', async (req, res) => {
    try {
        const { customername, membershipID, phoneNumber, birthDate, anniversaryDate, registeredDate, validTillDate } = req.body;
        const newMembership = new Membership({
            customername,
            membershipID,
            phoneNumber,
            birthDate,
            anniversaryDate,
            registeredDate,
            validTillDate
        });
        await newMembership.save();
        res.json({ success: true, message: 'Membership added successfully!' });
    } catch (error) {
        console.error('Error adding membership:', error);
        res.status(500).json({ success: false, message: 'Failed to add membership' });
    }
});

app.post('/find-membership', async (req, res) => {
    try {
        const { searchCardNumber, searchPhoneNumber } = req.body;
        const membership = await Membership.findOne({
            membershipID: searchCardNumber,
            phoneNumber: searchPhoneNumber
        });

        if (membership) {
            res.json({
                success: true,
                membershipID: membership.membershipID,
                phoneNumber: membership.phoneNumber,
                birthDate: membership.birthDate,
                anniversaryDate: membership.anniversaryDate || null,
                yearlyUsage: membership.yearlyUsage
            });
        } else {
            res.json({ success: false, message: "Membership not found" });
        }
    } catch (error) {
        console.error('Error finding membership:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.post("/add-signup", async (req, res) => {
    try {
        const mail = req.body.mail;
        const password = req.body.password;

        const user = await Signup.create({mail, password});
        if(user){
            res.status(200).redirect('/');
        }
        else{
            res.status(400);
        }
        
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get("/signin", (req, res) => {
    res.render("signin");
});

app.post("/do-signin",async (req,res)=>{

    try {
       const {mail, password}= req.body;
       console.log(mail,password);
       
       const Username = await Signup.findOne({mail});
       console.log(Username);
       
        if(Username){
            console.log(password,Username.password);
            if(password === Username.password){
                res.redirect('/');
            }
            else{
                res.status(400).send('Username/ password does not match');
            }
        }
        else{
            res.status(400).send('User not found');
        }
    } catch (error) {
        res.status(500).send(error.message);
    }

})

app.get('/staff', (req, res) => {
    res.render('staff');
});

// Route to handle form submission
app.post('/add-staff', async (req, res) => {
    const { name, birthdate, contactNumber, gender, address, jobTitle, employmentStartDate } = req.body;
    try {
        // Create a new staff document
        const newStaff = new Staff({
            name,
            birthdate,
            contactNumber,
            gender,
            address,
            jobTitle,
            employmentStartDate
        });
        // Save the staff to the database
        await newStaff.save();
        // Send JSON response
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false });
    }
});

app.listen(port, () => {
    console.log(`Server is running on ${port}`);
});
