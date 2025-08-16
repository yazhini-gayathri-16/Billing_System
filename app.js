const express = require("express");
const MongoStore = require('connect-mongo');
const cors = require('cors');
const cron = require('node-cron');
const multer = require('multer');
const session = require('express-session');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Signup = require("./models/signup");
const Fetch = require("./models/fetch"); // Ensure this points to the file where Fetch is defined
const Menu = require("./models/menu");
const Appointment = require('./models/appointment');
const Membership = require('./models/membership');
const Staff = require('./models/staff');
const MonthlyData = require('./models/monthlydata');
const Product = require('./models/inventory');
const Expense = require('./models/expenseschema'); 
const Package = require('./models/packages');
const EmployeeTarget = require('./models/employeeTarget'); // Add this line to import the new model
const ProductBill = require('./models/productBill');
const DailyCode = require('./models/dailycode');
const nodemailer = require('nodemailer'); // Add this at the top with other requires
const PDFDocument = require("pdfkit");
const FormData = require('form-data');
const axios = require('axios');
const fs = require("fs");
const path = require("path");
const ejs = require('ejs');
const puppeteer = require('puppeteer'); 
const whatsAppClient = require('@green-api/whatsapp-api-client');
const { Readable } = require('stream'); // Add this at the top with other requires



require("./connection");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // for example, 10 MB limit
});

app.use(session({
    secret: 'noble-evergreen',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false // Set to true if using HTTPS
    }
}));

const doc = new PDFDocument();
const pdfPath = path.join(__dirname, 'billing_data.pdf');
const writeStream = fs.createWriteStream(pdfPath);
doc.pipe(writeStream);



// Initialize the REST API client
// const restAPI = whatsAppClient.restAPI({
//     idInstance: '7105217263',
//     apiTokenInstance: 'e9897cac52f64553bb62434c7ab4f304de7a915f81994be383'
//   });

// Green API credentials
const GREEN_API_INSTANCE_ID = '7105239852';
const GREEN_API_TOKEN = '21abe2abe5e541849654c53fb041f41bd11f81ef7ba3423182';  

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/signin');
    }
    next();
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).send('Access denied');
    }
};

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/signin');
});

// In your route handlers, pass the user role to the templates
app.use((req, res, next) => {
    res.locals.userRole = req.session.user ? req.session.user.role : null;
    next();
});

function generateRandomCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function isWithinRadius(location, center) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = location.latitude * Math.PI/180;
    const φ2 = center.latitude * Math.PI/180;
    const Δφ = (center.latitude-location.latitude) * Math.PI/180;
    const Δλ = (center.longitude-location.longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance <= center.radius;
}



const port = process.env.PORT || 3000;
app.set('view engine', 'ejs');
app.use(express.static("public"));


// In your app.js or server.js file
app.get("/", isAuthenticated, async (req, res) => {
    try {
        const staffMembers = await Staff.find({});
        const services = await Menu.find({});
        
        res.render("index", { 
            staffMembers, 
            services,
            userRole: req.session.user.role // Explicitly pass userRole
        });
    } catch (error) {
        console.error("Failed to fetch data:", error);
        res.status(500).send("Error loading the page.");
    }
});

app.post("/bill", async (req, res) => {
   try {
        const {
            customer_name,
            customer_number,
            date,
            time,
            gender,
            membershipID,
            subtotal,
            discountType,
            grandTotal,
            paymentMethod,
            billType,
            birthdayDiscountApplied,
            anniversaryDiscountApplied
        } = req.body;

        let finalDiscount = parseFloat(subtotal) - parseFloat(grandTotal);

        if (membershipID && (birthdayDiscountApplied || anniversaryDiscountApplied)) {
            const membership = await Membership.findOne({ membershipID });
            if (membership) {
                const today = new Date();
                const currentYear = today.getFullYear();
                let yearlyUsage = membership.yearlyUsage.find(u => u.year === currentYear);
                if (!yearlyUsage) {
                    yearlyUsage = {
                        year: currentYear,
                        usedBirthdayOffer: false,
                        usedAnniversaryOffer: false
                    };
                    membership.yearlyUsage.push(yearlyUsage);
                }
                if (birthdayDiscountApplied) yearlyUsage.usedBirthdayOffer = true;
                if (anniversaryDiscountApplied) yearlyUsage.usedAnniversaryOffer = true;
                await membership.save();
            }
        }

        let services = [];
        let index = 1;
        while (req.body[`services${index}`]) {
            const stylistId = req.body[`stylist${index}`];
            const stylist2Id = req.body[`stylist2${index}`];
            const stylist = await Staff.findById(stylistId);

            if (!stylist) {
                return res.status(400).send(`Stylist with ID ${stylistId} not found`);
            }

            let serviceObj = {
                name: req.body[`services${index}`],
                price: parseFloat(req.body[`prices${index}`]),
                stylist: stylist.name                
            };

            if (stylist2Id) {
                const stylist2 = await Staff.findById(stylist2Id);
                if (stylist2) {
                    serviceObj.stylist2 = stylist2.name;
                }
            }

            services.push(serviceObj);
            index++;
        }

        const user = await Fetch.create({
            customer_name,
            customer_number,
            date,
            time,
            gender,
            membershipID,
            subtotal: parseFloat(subtotal),
            discount: finalDiscount,
            discountType,
            grandTotal: parseFloat(grandTotal),
            paymentMethod,
            services,
            billType,
            birthdayDiscountApplied,
            anniversaryDiscountApplied
        });

        const currentMonth = new Date().toLocaleString('default', { month: 'short' });
        const currentYear = new Date().getFullYear();

        if (user) {
            await MonthlyData.findOneAndUpdate(
                { month: currentMonth, year: currentYear },
                { $inc: { achieved: 1 } },
                { upsert: true, new: true }
            );

            try {
                // Render HTML using billingTemplate.ejs
                const htmlContent = await new Promise((resolve, reject) => {
                    ejs.renderFile(
                        path.join(__dirname, 'views', 'billingTemplate.ejs'),
                        { data: [{
                            customer_name,
                            customer_number,
                            date,
                            time,
                            gender,
                            membershipID,
                            subtotal: parseFloat(subtotal),
                            discount: finalDiscount,
                            discountType,
                            grandTotal: parseFloat(grandTotal),
                            paymentMethod,
                            services,
                            billType
                        }] },
                        (err, html) => {
                            if (err) reject(err);
                            else resolve(html);
                        }
                    );
                });

                // // Generate PDF buffer using Puppeteer
                // const browser = await puppeteer.launch({
                //     executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
                //     headless: "new",
                //     args: ['--no-sandbox', '--disable-setuid-sandbox']
                // });
                // const page = await browser.newPage();
                // await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

                // const pdfBuffer = await page.pdf({
                //     format: "A4",
                //     printBackground: true
                // });

                // await browser.close();

                // // Wrap pdfBuffer in a Readable stream for form-data
                // const bufferStream = new Readable();
                // bufferStream.push(pdfBuffer);
                // bufferStream.push(null);

                // Instead of Puppeteer, use PDFKit to generate PDF in memory
        const { Readable } = require('stream');
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', async () => {
            const pdfBuffer = Buffer.concat(chunks);


                // Send PDF via WhatsApp using Green API
            const chatId = `91${customer_number}@c.us`;
            const bufferStream = new Readable();
            bufferStream.push(pdfBuffer);
            bufferStream.push(null);

            const form = new FormData();
            form.append('chatId', chatId);
            form.append('file', bufferStream, {
                filename: `Noble_Evergreen_Unisex_Salon.pdf`,
                contentType: 'application/pdf'
            });
            form.append('caption', `Dear ${customer_name}, thank you for visiting Noble Evergreen Salon. Please find your bill attached.`);

            try {
                const response = await axios.post(
                    `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/sendFileByUpload/${GREEN_API_TOKEN}`,
                    form,
                    { headers: form.getHeaders() }
                );

                res.json({
                    success: true,
                    message: 'Bill generated and PDF sent via WhatsApp',
                    billData: user
                });
            } catch (error) {
                console.error('PDF or WhatsApp send error:', error?.response?.data || error.message);
                res.json({
                    success: true,
                    message: 'Bill generated but PDF failed to send via WhatsApp',
                    billData: user
                });
            }
        });

        // --- PDF Content ---
        // Header and Title Block

        const address = 'Leelavathi Achaer Complex Opp. Muthoot Finance Immadihalli Main Road, Hagadur, Whitefiled, Bangalore - 560066';
        const addressWidth = 400; // Adjust width for your desired margin
        const addressX = (doc.page.width - addressWidth) / 2; // Center horizontally

        doc
            .rect(0, 0, doc.page.width, 80)
            .fill('#8DBE50')
            .fillColor('black')
            .fontSize(24)
            .font('Helvetica-Bold')
            .text('NOBLE EVERGREEN UNISEX SALON', { align: 'center', valign: 'center' })
            .moveDown(0.5)
            .fontSize(10)
            .font('Helvetica')
            .text(address, addressX, doc.y, {
                width: addressWidth,
                align: 'center'
            })
            .moveDown(1);

        // Invoice Info
        doc
            .moveDown(0.5)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text('INVOICE', { align: 'right' })
            .fontSize(10)
            .font('Helvetica')
            .text(`Date: ${date}`, { align: 'right' })
            .text(`Time: ${time}`, { align: 'right' })
            .moveDown(1);

        const leftX = doc.page.margins.left;    
        // Customer Details
        doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .text('Billing Receipt', leftX, doc.y)
            .moveDown(0.5)
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Customer Details', leftX, doc.y, { underline: true })
            .font('Helvetica')
            .moveDown(0.2)
            .fontSize(11)
            .text(`Name: ${customer_name}`, leftX, doc.y)
            .text(`Phone Number: ${customer_number}`, leftX, doc.y)
            .text(`Gender: ${gender}`, leftX, doc.y)
            .moveDown(0.5);

        // Services Table Header
        doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Services', leftX, doc.y, { underline: true })
            .moveDown(0.2);

        // Table column headers
        const tableTop = doc.y + 5;
        const colX = [doc.page.margins.left, 270, 440];
        doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('Service Name', colX[0], tableTop)
            .text('Price', colX[1], tableTop)
            .text('Stylist', colX[2], tableTop)

        // Draw header line
        doc
            .moveTo(colX[0], tableTop + 15)
            .lineTo(doc.page.width - doc.page.margins.right, tableTop + 15)
            .strokeColor('#ddd')
            .lineWidth(1)
            .stroke();

        // Table rows
        let rowY = tableTop + 20;
        doc.font('Helvetica');
        services.forEach(service => {
            doc
                .fontSize(10)
                .text(service.name, colX[0], rowY)
                .text(`Rs.${service.price.toFixed(2)}`, colX[1], rowY)
                .text(service.stylist + (service.stylist2 ? `, ${service.stylist2}` : ''), colX[2], rowY)
            rowY += 18;
        });

        // Totals Section
const labelX = doc.page.width - doc.page.margins.right - 200; // 200px from right, adjust as needed
const valueX = doc.page.width - doc.page.margins.right - 150;       // right margin

doc.moveDown(2)
   .fontSize(12)
   .font('Helvetica-Bold');

let y = doc.y;
doc.text('Subtotal:', labelX, y);
doc.text(`Rs.${parseFloat(subtotal).toFixed(2)}`, valueX, y, { align: 'right' });
doc.moveDown(0.5);

y = doc.y + 5;
doc.text('Discount:', labelX, y);
doc.text(`Rs.${finalDiscount.toFixed(2)} (${discountType})`, valueX, y, { align: 'right' });
doc.moveDown(0.5);

y = doc.y + 5;
doc.text('Grand Total:', labelX, y);
doc.text(`Rs.${parseFloat(grandTotal).toFixed(2)}`, valueX, y, { align: 'right' });


doc.moveDown(0.5)
   .font('Helvetica')
   .fontSize(11);

        doc.end();
        // --- End PDF Content ---

    } catch (err) {
        console.error("Error creating bill:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
}catch (error) {
        console.error("Error creating bill:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

app.get("/packageBilling", async (req, res) => {
    try {
        // Fetch all staff members and packages from the database
        const staffMembers = await Staff.find({});
        const packages = await Package.find({}); // Fetch packages from the Package collection
        
        // Pass staff members and packages to the EJS template
        res.render("packagebill", { staffMembers, packages });
    } catch (error) {
        console.error("Failed to fetch data:", error);
        res.status(500).send("Error loading the package billing page.");
    }
});

app.post("/packageBill", async (req, res) => {
    try {
            const {
            customer_name,
            customer_number,
            date,
            time,
            gender,
            membershipID,
            subtotal,
            discountPercentage,
            discountRupees,
            discountType,
            grandTotal,
            paymentMethod,
            billType,
            birthdayDiscountApplied,      // <-- Add this
            anniversaryDiscountApplied    // <-- And this
        } = req.body;

        let finalDiscount = 0;
        if (discountType === "percentage") {
            finalDiscount = parseFloat(subtotal) * (parseFloat(discountPercentage) || 0) / 100;
        } else if (discountType === "rupees") {
            finalDiscount = parseFloat(discountRupees) || 0;
        }
        finalDiscount = parseFloat(finalDiscount.toFixed(2));
        const finalGrandTotal = parseFloat(subtotal) - finalDiscount;

        // Build services array from request (similar to /bill)
        let services = [];
        let index = 1;
        while (req.body[`packages${index}`]) {
            const stylistId = req.body[`stylist${index}`];
            const stylist2Id = req.body[`stylist2${index}`];
            let serviceObj = {
                name: req.body[`packages${index}`],
                price: parseFloat(req.body[`prices${index}`]),
                stylist: undefined,
                stylist2: undefined
            };
            if (stylistId) {
                const stylist = await Staff.findById(stylistId);
                if (stylist) serviceObj.stylist = stylist.name;
            }
            if (stylist2Id) {
                const stylist2 = await Staff.findById(stylist2Id);
                if (stylist2) serviceObj.stylist2 = stylist2.name;
            }
            services.push(serviceObj);
            index++;
        }

        // Create bill record (already present in your code)
        const user = await Fetch.create({
            customer_name,
            customer_number,
            date,
            time,
            gender,
            membershipID,
            subtotal: parseFloat(subtotal),
            discount: finalDiscount,
            discountType,
            grandTotal: finalGrandTotal,
            paymentMethod,
            services,
            billType,
            birthdayDiscountApplied,
            anniversaryDiscountApplied
        });

        if (user) {
            // --- PDF Generation ---
            const PDFDocument = require('pdfkit');
            const { Readable } = require('stream');
            const doc = new PDFDocument({ size: 'A3', margin: 50 });
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', async () => {
                const pdfBuffer = Buffer.concat(chunks);

                // --- WhatsApp Notification ---
                const chatId = `91${customer_number}@c.us`;
                const bufferStream = new Readable();
                bufferStream.push(pdfBuffer);
                bufferStream.push(null);

                const form = new FormData();
                form.append('chatId', chatId);
                form.append('file', bufferStream, {
                    filename: `Noble_Evergreen_Package_Bill.pdf`,
                    contentType: 'application/pdf'
                });
                form.append('caption', `Dear ${customer_name}, thank you for your package purchase at Noble Evergreen Salon. Please find your bill attached.`);

                try {
                    await axios.post(
                        `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/sendFileByUpload/${GREEN_API_TOKEN}`,
                        form,
                        { headers: form.getHeaders() }
                    );
                } catch (err) {
                    console.error('WhatsApp send error:', err?.response?.data || err.message);
                }

                res.json({
                    success: true,
                    message: 'Package bill generated and PDF sent via WhatsApp',
                    billData: user
                });
            });

            // --- PDF Content ---
            doc
                .rect(0, 0, doc.page.width, 80)
                .fill('#8DBE50')
                .fillColor('black')
                .fontSize(24)
                .font('Helvetica-Bold')
                .text('NOBLE EVERGREEN UNISEX SALON', { align: 'center' })
                .moveDown(0.5)
                .fontSize(10)
                .font('Helvetica')
                .text('Leelavathi Achaer Complex Opp. Muthoot Finance Immadihalli Main Road, Hagadur, Whitefiled, Bangalore - 560066', { align: 'center' })
                .moveDown(1);

            doc
                .moveDown(0.5)
                .fontSize(14)
                .font('Helvetica-Bold')
                .text('PACKAGE BILL', { align: 'right' })
                .fontSize(10)
                .font('Helvetica')
                .text(`Date: ${date}`, { align: 'right' })
                .text(`Time: ${time}`, { align: 'right' })
                .moveDown(1);

            doc
                .fontSize(12)
                .font('Helvetica-Bold')
                .text('Customer Details')
                .font('Helvetica')
                .fontSize(11)
                .text(`Name: ${customer_name}`)
                .text(`Phone Number: ${customer_number}`)
                .text(`Gender: ${gender}`)
                .moveDown(0.5);

            // Packages Table
            doc
                .fontSize(12)
                .font('Helvetica-Bold')
                .text('Packages')
                .moveDown(0.2);

            const tableTop = doc.y + 5;
            const colX = [doc.page.margins.left, 270, 370, 470, 570];
            doc
                .fontSize(11)
                .font('Helvetica-Bold')
                .text('Package Name', colX[0], tableTop)
                .text('Price', colX[1], tableTop)
                .text('Stylist 1', colX[2], tableTop)
                .text('Stylist 2', colX[3], tableTop)
                .text('Total', colX[4], tableTop);

            doc
                .moveTo(colX[0], tableTop + 15)
                .lineTo(doc.page.width - doc.page.margins.right, tableTop + 15)
                .strokeColor('#ddd')
                .lineWidth(1)
                .stroke();

            let rowY = tableTop + 20;
            doc.font('Helvetica');
            (services || []).forEach(pkg => {
                doc.text(pkg.name, colX[0], rowY)
                    .text(`Rs.${parseFloat(pkg.price).toFixed(2)}`, colX[1], rowY)
                    .text(pkg.stylist || '-', colX[2], rowY)
                    .text(pkg.stylist2 || '-', colX[3], rowY)
                    .text(`Rs.${parseFloat(pkg.price).toFixed(2)}`, colX[4], rowY);
                rowY += 18;
            });

            // Totals Section
            doc.moveDown(2)
                .fontSize(12)
                .font('Helvetica-Bold');
            let y = doc.y;
            doc.text('Subtotal:', colX[3], y);
            doc.text(`Rs.${parseFloat(subtotal).toFixed(2)}`, colX[4], y, { align: 'right' });
            doc.moveDown(0.5);

            y = doc.y + 5;
            doc.text('Discount:', colX[3], y);
            doc.text(`Rs.${parseFloat(finalDiscount).toFixed(2)} (${discountType})`, colX[4], y, { align: 'right' });
            doc.moveDown(0.5);

            y = doc.y + 5;
            doc.text('Grand Total:', colX[3], y);
            doc.text(`Rs.${parseFloat(finalGrandTotal).toFixed(2)}`, colX[4], y, { align: 'right' });

            doc.end();
        } else {
            res.json({
                success: false,
                message: 'Failed to create receipt'
            });
        }
    } catch (err) {
        console.error("Error creating bill:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

app.post('/search-customer', async (req, res) => {
    try {
        const { customerNumber } = req.body;

        // First check membership status since it should be independent of purchase history 

        //- commented by yazhini - beg
        // const membership = await Membership.findOne({ phoneNumber: customerNumber }); - for adding new membership field
        
        // Initialize membership variables  
        // let membershipStatus = '----';
        // let membershipID = null;
        // let canUseBirthdayOffer = false;
        // let canUseAnniversaryOffer = false;
        
        // if (membership) {
        //     membershipID = membership.membershipID;
        //     membershipStatus = 'Active';

        //     // Check if membership is expired
        //     const today = new Date();
        //     if (membership.validTillDate < today) {
        //         membershipStatus = 'Expired';
        //     } else {
        //         // Check for birthday and anniversary offers
        //         const currentMonth = today.getMonth();
        //         const birthMonth = new Date(membership.birthDate).getMonth();
        //         const anniversaryMonth = membership.anniversaryDate ? new Date(membership.anniversaryDate).getMonth() : -1;
        //         const currentYear = today.getFullYear();
        //         const yearlyUsage = membership.yearlyUsage.find(usage => usage.year === currentYear);

        //         if (currentMonth === birthMonth && (!yearlyUsage || !yearlyUsage.usedBirthdayOffer)) {
        //             canUseBirthdayOffer = true;
        //         }

        //         if (currentMonth === anniversaryMonth && (!yearlyUsage || !yearlyUsage.usedAnniversaryOffer)) {
        //             canUseAnniversaryOffer = true;
        //         }
        //     }
        // }
        //- commented by yazhini - end

        // Fetch customer purchase history
        const fetchCustomerData = await Fetch.find({ customer_number: customerNumber });
        const productBillCustomerData = await ProductBill.find({ customer_number: customerNumber });
        const combinedData = [...fetchCustomerData, ...productBillCustomerData];

        if (combinedData.length > 0) {  // Return data if either purchase history exists OR customer has membership
            const totalSpent = combinedData.reduce((sum, record) => {
                if (record.services) {
                    return sum + record.services.reduce((serviceSum, service) => serviceSum + service.price, 0);
                } else if (record.products) {
                    return sum + record.products.reduce((productSum, product) => productSum + product.total, 0);
                }
                return sum;
            }, 0);

            const visits = combinedData.length;
            const lastVisit = combinedData.length > 0 ? 
                combinedData.reduce((latest, record) => {
                    const recordDate = new Date(record.date);
                    return recordDate > latest ? recordDate : latest;
                }, new Date(0)).toISOString().split('T')[0] : 
                'First Visit';

            const services = fetchCustomerData.flatMap(record => record.services.map(service => service.name));
            const products = productBillCustomerData.flatMap(record => record.products.map(product => product.name));
            const uniqueServices = [...new Set(services)];
            const uniqueProducts = [...new Set(products)];

            let customerType = 'New';
            if (visits > 0) {
                const lastVisitDate = new Date(lastVisit);
                const daysSinceLastVisit = (new Date() - lastVisitDate) / (1000 * 60 * 60 * 24);

                if (visits > 2) {
                    customerType = 'Active';
                } else if (daysSinceLastVisit > 180) {
                    customerType = 'Dormant';
                }
            }

            // Get customer info or use membership info for first-time visitors
            const customerInfo = combinedData[0] || { 
                customer_name: '----'
            };
            
            res.json({
                success: true,
                cust_name: customerInfo.customer_name,
                customerType,
                lastVisit,
                visits,
                totalSpent,
                services: uniqueServices,
                products: uniqueProducts
                // membership: membershipStatus,
                // membershipID,
                // canUseBirthdayOffer,
                // canUseAnniversaryOffer
            });
        } else {
            res.json({ success: false, message: 'Customer not found' });
        }
    } catch (error) {
        console.error('Error retrieving customer data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// Apply middleware to routes
app.get('/dashboard', isAuthenticated, isAdmin, (req, res) => {
    res.render("analytics");
});



app.get('/employees',async (req,res)=>{
    try {

        // Fetch data for staff members
        const staffMembers = await Staff.find();

        // Render the dashboard and pass staffMembers data
        res.render('employees', { staffMembers });
    } catch (error) {
        console.error("Failed to fetch staff members:", error);
        res.status(500).send("Error loading the employees.");
    }
});

app.get("/packagebill", async (req, res) => {
    try {
        // Fetch all staff members and packages from the database
        const staffMembers = await Staff.find({});
        const packages = await Package.find({}); // Fetch packages from the Package collection
        
        // Pass staff members and packages to the EJS template
        res.render("packagebill", { staffMembers, packages });
    } catch (error) {
        console.error("Failed to fetch data:", error);
        res.status(500).send("Error loading the package billing page.");
    }
});

app.get("/api/packages", async (req, res) => {
    try {
        // Fetch all packages from the database
        const packages = await Package.find({});
        
        // Send the package list as JSON response
        res.status(200).json(packages);
    } catch (error) {
        console.error("Failed to fetch packages:", error);
        res.status(500).json({ error: "Failed to fetch packages" });
    }
});




// Route for getting package management page
app.get('/packages', async (req, res) => {
    try {
        const packages = await Package.find();
        res.render('packages', { packages });
    } catch (error) {
        res.status(500).send('Error accessing package management page');
    }
});

app.get('/packages-display', async (req, res) => {
    try {
        const packages = await Package.find();
        res.render('packagesview', { packages });
    } catch (error) {
        res.status(500).send('Error accessing package management page');
    }
});


// Route to add a new package
app.post('/add-package', async (req, res) => {
    try {
        const { packageName, packagePrice, includedServices, gender } = req.body;
        const servicesArray = includedServices.split(',').map(service => service.trim()); // Assuming services are submitted as a comma-separated list
        const newPackage = new Package({ packageName, packagePrice, includedServices: servicesArray, gender });
        await newPackage.save();
        res.redirect('/packages');
    } catch (error) {
        res.status(500).send('Error adding new package');
    }
});


// Route to edit an existing package
app.post('/edit-package', async (req, res) => {
    try {
        const { id, packageName, packagePrice, includedServices, gender } = req.body;
        const servicesArray = includedServices.split(',').map(service => service.trim());
        await Package.findByIdAndUpdate(id, { packageName, packagePrice, includedServices: servicesArray, gender });
        res.redirect('/packages');
    } catch (error) {
        res.status(500).send('Error updating package');
    }
});


// Route to delete a package
app.post('/delete-package', async (req, res) => {
    try {
        const { id } = req.body;
        await Package.findByIdAndDelete(id);
        res.redirect('/packages');
    } catch (error) {
        res.status(500).send('Error deleting package');
    }
});


app.get('/sales', async (req, res) => {
    try {
        const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

        // Total income from all sources
        const totalIncome = await Fetch.aggregate([
            { $match: { date: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } }
        ]);

        const totalIncomePro = await ProductBill.aggregate([
            { $match: { date: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } }
        ]);

        // Total expenses for the current month
        const totalExpenses = await Expense.aggregate([
            { $match: { date: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        // Sum of income specifically from services for the current month, assuming services have a specific type or category
        const serviceIncome = await Fetch.aggregate([
            {
                $match: {
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    billType: "service"
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$grandTotal" }
                }
            }
        ]);

        // Sum of income specifically from packages for the current month, assuming packages have a specific type or category
        const packageIncome = await Fetch.aggregate([
            {
                $match: {
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    billType: "package"
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$grandTotal" }
                }
            }
        ]);

        // Sum of membership fees collected this month
        const membershipIncome = await Membership.aggregate([
            { $match: { registeredDate: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
            { $group: { _id: null, total: { $sum: "$memprice" } } }
        ]);

        const totalIncomeUPI = await Fetch.aggregate([
            { 
                $match: { 
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    paymentMethod: "UPI", billType: "service" 
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$grandTotal" } 
                }
            }
        ]);

        const totalIncomeCard = await Fetch.aggregate([
            { 
                $match: { 
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    paymentMethod: "Card", billType: "service" 
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$grandTotal" } 
                }
            }
        ]);

        const totalIncomeCash = await Fetch.aggregate([
            { 
                $match: { 
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    paymentMethod: "Cash", billType: "service" 
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$grandTotal" } 
                }
            }
        ]);

        const totalIncomeUPIP = await Fetch.aggregate([
            { 
                $match: { 
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    paymentMethod: "UPI", billType: "package" 
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$grandTotal" } 
                }
            }
        ]);

        const totalIncomeCardP = await Fetch.aggregate([
            { 
                $match: { 
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    paymentMethod: "Card", billType: "package" 
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$grandTotal" } 
                }
            }
        ]);

        const totalIncomeCashP = await Fetch.aggregate([
            { 
                $match: { 
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    paymentMethod: "Cash", billType: "package" 
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$grandTotal" } 
                }
            }
        ]);

        const totalIncomeUPIM = await Membership.aggregate([
            { 
                $match: { 
                    registeredDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    mempaymentMethod: "UPI" 
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$memprice" } 
                }
            }
        ]);
        
        const totalIncomeCardM = await Membership.aggregate([
            { 
                $match: { 
                    registeredDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    mempaymentMethod: "Card" 
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$memprice" } 
                }
            }
        ]);
        
        const totalIncomeCashM = await Membership.aggregate([
            { 
                $match: { 
                    registeredDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    mempaymentMethod: "Cash" 
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$memprice" } 
                }
            }
        ]);

        const totalIncomeUPIPro = await ProductBill.aggregate([
            { 
                $match: { 
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    paymentMethod: "UPI" 
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$grandTotal" } 
                }
            }
        ]);

        const totalIncomeCardPro = await ProductBill.aggregate([
            { 
                $match: { 
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    paymentMethod: "Card"
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$grandTotal" } 
                }
            }
        ]);

        const totalIncomeCashPro = await ProductBill.aggregate([
            { 
                $match: { 
                    date: { $gte: currentMonthStart, $lte: currentMonthEnd },
                    paymentMethod: "Cash"
                }
            },
            { 
                $group: { 
                    _id: null, 
                    total: { $sum: "$grandTotal" } 
                }
            }
        ]);

        // Safe accessing of aggregation results
        const totalUPI = totalIncomeUPI.length > 0 ? totalIncomeUPI[0].total : 0;
        const totalCard = totalIncomeCard.length > 0 ? totalIncomeCard[0].total : 0;
        const totalCash = totalIncomeCash.length > 0 ? totalIncomeCash[0].total : 0;

        const totalUPIM = totalIncomeUPIM.length > 0 ? totalIncomeUPIM[0].total : 0;
        const totalCardM = totalIncomeCardM.length > 0 ? totalIncomeCardM[0].total : 0;
        const totalCashM = totalIncomeCashM.length > 0 ? totalIncomeCashM[0].total : 0;

        const totalUPIP = totalIncomeUPIP.length > 0 ? totalIncomeUPIP[0].total : 0;
        const totalCardP = totalIncomeCardP.length > 0 ? totalIncomeCardP[0].total : 0;
        const totalCashP = totalIncomeCashP.length > 0 ? totalIncomeCashP[0].total : 0;

        const totalUPIPro = totalIncomeUPIPro.length > 0 ? totalIncomeUPIPro[0].total : 0;
        const totalCardPro = totalIncomeCardPro.length > 0 ? totalIncomeCardPro[0].total : 0;
        const totalCashPro = totalIncomeCashPro.length > 0 ? totalIncomeCashPro[0].total : 0;
        

        const totUPI = totalUPI + totalUPIM + totalUPIP + totalUPIPro;
        const totCard = totalCard + totalCardM + totalCardP + totalCardPro;
        const totCash = totalCash + totalCashM + totalCashP + totalCashPro;

        const finalTotal = (totalIncome[0] ? totalIncome[0].total : 0) + (membershipIncome[0] ? membershipIncome[0].total : 0) + (totalIncomePro[0] ? totalIncomePro[0].total : 0);
        
        res.render('sales', {
            totalIncome: finalTotal,
            totalExpenses: totalExpenses[0] ? totalExpenses[0].total : 0,
            serviceIncome: serviceIncome[0] ? serviceIncome[0].total : 0,
            packageIncome: packageIncome[0] ? packageIncome[0].total : 0,
            membershipIncome: membershipIncome[0] ? membershipIncome[0].total : 0,
            totalIncomeProIncome : totalIncomePro[0] ? totalIncomePro[0].total : 0,
            totalUPI,
            totalCard,
            totalCash,
            totalUPIP,
            totalCardP,
            totalCashP,
            totalUPIPro,
            totalCardPro,
            totalCashPro,
            totalUPIM,
            totalCardM,
            totalCashM,
            totUPI,
            totCard,
            totCash
        });
    } catch (error) {
        console.error('Error fetching sales data:', error);
        res.status(500).send('Error loading sales data');
    }
});



app.get('/monthly-data', async (req, res) => {
    try {
        const data = await MonthlyData.find().sort({ createdAt: 1 }); // Sort by 'createdAt' in ascending order
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching monthly data", error });
    }
});

app.post('/monthly-data', async (req, res) => {
    const { month, year, target, achieved } = req.body;

    try {
        const existingData = await MonthlyData.findOne({ month, year });
        if (existingData) {
            // Update existing record
            existingData.target = target;
            existingData.achieved = achieved;
            await existingData.save();
        } else {
            // Create new record
            await MonthlyData.create({ month, year, target, achieved });
        }
        res.status(200).json({ message: "Monthly data saved successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error saving monthly data", error });
    }
});


app.get('/current-month-data', async (req, res) => {
    try {
        const currentDate = new Date();
        const month = currentDate.toLocaleString('default', { month: 'short' });
        const year = currentDate.getFullYear();

        const currentMonthData = await MonthlyData.findOne({ month, year });

        if (currentMonthData) {
            res.json({
                success: true,
                target: currentMonthData.target,
                achieved: currentMonthData.achieved,
            });
        } else {
            res.json({
                success: false,
                message: "No data found for the current month",
            });
        }
    } catch (error) {
        res.status(500).json({ message: "Error fetching current month data", error });
    }
});




// Endpoint to get the count of clients for the current month
app.get('/client-count', async (req, res) => {
    try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
        
        const clientCount = await Fetch.countDocuments({
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });
        
        res.json({ clientCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching client count', error });
    }
});


// Endpoint to get gender diversity data
app.get('/gender-data', async (req, res) => {
    try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
        
        const maleCount = await Fetch.countDocuments({ gender: 'Male',  date: { $gte: startOfMonth, $lte: endOfMonth }});
        const femaleCount = await Fetch.countDocuments({ gender: 'Female',  date: { $gte: startOfMonth, $lte: endOfMonth } });
        const othersCount = await Fetch.countDocuments({ gender: 'Other',  date: { $gte: startOfMonth, $lte: endOfMonth } });

        res.json({ maleCount, femaleCount, othersCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching gender diversity data', error });
    }
});


// Endpoint to get the count of employees
app.get('/menu-count', async (req, res) => {
    try {
        const serviceCount = await Menu.countDocuments();
       
        
        res.json({ serviceCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching service count', error });
    }
});

// Endpoint to get the count of upcoming appointments
app.get('/appointment-count', async (req, res) => {
    try {
        const now = new Date(); // Current date and time
        
        const upcomingAppointmentCount = await Appointment.countDocuments({
            dateTime: { $gte: now } // Only count future appointments
        });
        
        res.json({ appointmentCount: upcomingAppointmentCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching appointment count', error });
    }
});

// Endpoint to get the count of valid, non-expired memberships
app.get('/valid-membership-count', async (req, res) => {
    try {
        const now = new Date(); // Current date and time
        const validMembershipCount = await Membership.countDocuments({
            validTillDate: { $gte: now } // Only count memberships with a future expiration date
        });
        res.json({ validMembershipCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching valid membership count', error });
    }
});



// Endpoint to get top trending services for the current month
app.get('/trending-services', async (req, res) => {
    try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

        // Aggregate data to get the count of each service's usage within the current month
        const topServices = await Fetch.aggregate([
            { 
                $match: { 
                    date: { $gte: startOfMonth, $lte: endOfMonth } 
                } 
            },
            { $unwind: "$services" },
            { $group: { _id: "$services.name", utilization: { $sum: 1 } } },
            { $sort: { utilization: -1 } },
            { $limit: 10 } // Limit to top 10 services
        ]);

        const trendingServices = topServices.map((service, index) => ({
            name: service._id,
            utilization: service.utilization,
        }));

        res.json(trendingServices);
    } catch (error) {
        res.status(500).json({ message: "Error fetching trending services", error });
    }
});

// Route to get appointments for a specific date
app.get('/appointments/:date', async (req, res) => {
    const selectedDate = req.params.date; // YYYY-MM-DD format

    // Construct the start of the day and end of the day in UTC
    const startOfDay = new Date(Date.UTC(...selectedDate.split('-').map((v, i) => i === 1 ? v - 1 : v), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(...selectedDate.split('-').map((v, i) => i === 1 ? v - 1 : v), 23, 59, 59));

    try {
        // Fetch appointments where the dateTime is between start and end of the day in UTC
        const appointments = await Appointment.find({
            dateTime: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ dateTime: 1 });

        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching appointments', error });
    }
});


// Ensure you add this part in your app.js to schedule the task
// Schedule a task to run at midnight on the 1st of each month
cron.schedule('0 0 1 * *', async () => {
    try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.toLocaleString('default', { month: 'short' }); // E.g., "Jan"
        
        // Check if the record for the new month already exists to avoid duplicates
        const existingData = await MonthlyData.findOne({ month: currentMonth, year: currentYear });

        if (!existingData) {
            // Create a new record for the new month with default target and achieved values
            await MonthlyData.create({
                month: currentMonth,
                year: currentYear,
                target: 0,    // Set initial target as 0, can be updated later
                achieved: 0   // Set initial achieved as 0, will be updated as the month progresses
            });
            console.log(`Monthly data created for ${currentMonth} ${currentYear}`);
        } else {
            console.log(`Monthly data for ${currentMonth} ${currentYear} already exists.`);
        }
    } catch (error) {
        console.error("Error creating monthly data:", error);
    }
});

// Endpoint to set or update the monthly target and achieved values
app.post('/set-monthly-target', async (req, res) => {
    const { target } = req.body;
    const currentDate = new Date();
    const month = currentDate.toLocaleString('default', { month: 'short' });
    const year = currentDate.getFullYear();

    try {
        // Calculate the number of clients achieved for the current month
        const startOfMonth = new Date(year, currentDate.getMonth(), 1);
        const endOfMonth = new Date(year, currentDate.getMonth() + 1, 0, 23, 59, 59);
        const achieved = await Fetch.countDocuments({ date: { $gte: startOfMonth, $lte: endOfMonth } });

        // Find or update the monthly data for the current month
        let monthlyData = await MonthlyData.findOneAndUpdate(
            { month, year },
            { target, achieved },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: "Monthly target updated successfully", data: monthlyData });
    }catch (error){
        res.status(500).json({ message: "Error updating monthly data", error });
    }
});

// Endpoint to fetch monthly data for display purposes
app.get('/monthly-data', async (req, res) => {
    try {
        const data = await MonthlyData.find().sort({ createdAt: 1 }); // Sort by 'createdAt' in ascending order
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching monthly data", error });
    }
});


// Route to display the expense form
app.get('/expenses', (req, res) => {
    res.render('expenses');
});

// Route to handle form submission
app.post('/add-expense', (req, res) => {
    const { type, description, amount, date } = req.body;
    
    // Here you can validate the inputs
    if (!type || !description || !amount || !date) {
        return res.status(400).json({ message: 'All fields are required!' });
    }

    const newExpense = new Expense({ type, description, amount, date });
    newExpense.save()
        .then(() => res.json({ message: 'Expense added successfully' }))
        .catch(err => res.status(400).json({ error: 'Failed to add expense' }));
});



app.post('/validate-membership', async (req, res) => {
    try {
        let { membershipID } = req.body;        
        const membership = await Membership.findOne({ membershipID });
        let membershipStatus = '----';
        let canUseBirthdayOffer = false;
        let canUseAnniversaryOffer = false;

        if (membership) {
            membershipStatus = 'Active';

            // Check if membership is expired
            const today = new Date();
            if (membership.validTillDate < today) {
                membershipStatus = 'Expired';
            } else {
                // Check for birthday and anniversary offers
                const currentMonth = today.getMonth();
                const birthMonth = new Date(membership.birthDate).getMonth();
                const anniversaryMonth = membership.anniversaryDate ? new Date(membership.anniversaryDate).getMonth() : -1;
                const currentYear = today.getFullYear();
                const yearlyUsage = membership.yearlyUsage.find(usage => usage.year === currentYear);

                if (currentMonth === birthMonth && (!yearlyUsage || !yearlyUsage.usedBirthdayOffer)) {
                    canUseBirthdayOffer = true;
                }

                if (currentMonth === anniversaryMonth && (!yearlyUsage || !yearlyUsage.usedAnniversaryOffer)) {
                    canUseAnniversaryOffer = true;
                }
            }
        } else {
            return res.status(404).json({ message: 'Wrong membership ID' });
        }

        if (membershipStatus === 'Expired') {
            return res.status(200).json({ message: 'Membership ID expired' });
        }

        res.status(200).json({
            message: 'Valid membership ID',
            membership: membershipStatus,
            membershipID,
            canUseBirthdayOffer,
            canUseAnniversaryOffer
        });
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

app.get("/api/packages", async (req, res) => {
    try {
        const packages = await Package.find({}, 'packageName packagePrice -_id');
        res.json(packages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// In your app.js or a specific routes file
app.get("/appointment", async (req, res) => {
    try {
        const staffMembers = await Staff.find({});
        const currentTimeIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);

        const appointments = await Appointment.find({ dateTime: { $gt: currentTimeIST } });
        res.render("appointment", { appointments, staffMembers });
    } catch (error) {
        console.error("Failed to fetch staff members:", error);
        res.status(500).send("Error loading appointments");
    }
});

// Protect admin routes
app.get('/analytics', isAuthenticated, isAdmin, (req, res) => {
    res.render('analytics');
});


app.get('/remainders',(req,res)=>{
    res.render('remainders');
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
        const currentTimeIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);

        const appointments = await Appointment.find({ dateTime: { $gt: currentTimeIST } });
        //console.log(appointments);
        

        res.json({
            success: true,
            appointmentIndex: appointments.length,
            customerName: newAppointment.customerName,
            dateTime: newAppointment.dateTime,
            contactNumber: newAppointment.contactNumber,
            id: newAppointment._id
        });

        const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nobleevergreen2024@gmail.com',
        pass: 'pmgz dgxu uizj umwy' // Use your Gmail App Password
    }
});

const mailOptions = {
    from: 'nobleevergreen2024@gmail.com',
    to: 'raguld2105@gmail.com',
    subject: 'New Appointment Added',
    html: `
        <h2>New Appointment Added</h2>
        <ul>
            <li><strong>Customer Name:</strong> ${newAppointment.customerName}</li>
            <li><strong>Date & Time:</strong> ${newAppointment.dateTime}</li>
            <li><strong>Contact Number:</strong> ${newAppointment.contactNumber}</li>
            <li><strong>Stylist:</strong> ${newAppointment.specialist}</li>
            <li><strong>Service Type:</strong> ${newAppointment.serviceType}</li>
            <li><strong>Special Needs:</strong> ${newAppointment.specialNeeds || 'N/A'}</li>
        </ul>
    `
};

try {
    await transporter.sendMail(mailOptions);
} catch (emailErr) {
    console.error('Error sending appointment email:', emailErr);
}
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


// app.post('/search-client', async (req, res) => {
//     try {
//         const {customer_num } = req.body;
//         // Create a case-insensitive regular expression for customer name
       

//         const customerData = await Fetch.find({
//             customer_number: customer_num
//         });

//         if (customerData.length > 0) {
//             const totalSpent = customerData.reduce((sum, record) => sum + record.services.reduce((serviceSum, service) => serviceSum + service.price, 0), 0);
//             const services = customerData.flatMap(record => record.services.map(service => service.name));
//             const uniqueServices = [...new Set(services)];

//             res.json({
//                 success: true,
//                 visits: customerData.length,
//                 totalSpent,
//                 services: uniqueServices
//             });
//         } else {
//             res.json({ success: false });
//         }
//     } catch (error) {
//         console.error('Error retrieving customer data:', error);
//         res.status(500).json({ success: false, message: 'Internal server error' });
//     }
// });

app.post('/add-membership', async (req, res) => {

    try {
        const { customername, membershipID, phoneNumber, birthDate, anniversaryDate, registeredDate, validTillDate, memprice, mempaymentMethod } = req.body;
        const currentYear = new Date().getFullYear();
        const newMembership = new Membership({
            customername,
            membershipID,
            phoneNumber,
            birthDate,
            anniversaryDate,
            registeredDate,
            validTillDate,
            memprice,             
            mempaymentMethod,
            yearlyUsage: [{
                year: currentYear,
                usedBirthdayOffer: false,
                usedAnniversaryOffer: false
            }]
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
        const {searchPhoneNumber } = req.body;
        const membership = await Membership.findOne({
            phoneNumber: searchPhoneNumber
        });

        if (membership) {
            res.json({
                success: true,
                name: membership.customername,
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

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/add-signup", async (req, res) => {
    try {
        const { mail, password, role } = req.body;
        // Validate role
        if (!['admin', 'staff'].includes(role)) {
            return res.status(400).send('Invalid role');
        }
        const userTest = await Signup.findOne({ mail, role });
        if(userTest) {
            return res.status(400).send('User already exists with this email and role');
        }
        else{
        // Create new user
        const user = await Signup.create({ mail, password, role });
        
        if(user) {
            res.status(200).redirect('/signin');
        } else {
            res.status(400).send('Failed to create user');
        }
    }
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get("/signin", (req, res) => {
    res.render("signin");
});

app.post("/do-signin", async (req, res) => {
    try {
        const { mail, password } = req.body;
        const user = await Signup.findOne({ mail, password });
        
        if (user && password === user.password) {
            // If staff user, verify staff record exists
            if (user.role === 'staff') {
                const staff = await Staff.findOne({ email: mail });
                if (!staff) {
                    return res.status(400).send('Staff record not found');
                }
            }

            req.session.user = {
                mail: user.mail,
                role: user.role
            };
            
            res.redirect('/');
        } else {
            res.status(400).send('Invalid credentials');
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Staff dashboard route
app.get('/staff-dashboard', isAuthenticated, (req, res) => {
    if (req.session.user.role === 'staff') {
        res.render('staff-dashboard', { user: req.session.user });
    } else {
        res.redirect('/dashboard');
    }
});


// Route to render the employee targets page
app.get('/employee-targets', async (req, res) => {
    try {
        const staffMembers = await Staff.find({});
        const currentMonth = new Date().toLocaleString('default', { month: 'short' });
        const currentYear = new Date().getFullYear();
        
        // First update achievements before displaying
        const startDate = new Date(currentYear, new Date().getMonth(), 1);
        const endDate = new Date(currentYear, new Date().getMonth() + 1, 0);

        // Aggregate achievements for primary stylist
        const achievements = await Fetch.aggregate([
            {
                $match: {
                    date: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            { $unwind: "$services" },
            {
                $group: {
                    _id: "$services.stylist",
                    totalAchieved: { $sum: { 
                        $cond: [
                            { $eq: ["$services.stylist2", null] },
                            "$services.price",
                            { $multiply: ["$services.price", 0.7] } // 70% for primary stylist
                        ]
                    }}
                }
            }
        ]);

        // Aggregate achievements for secondary stylist
        const secondaryAchievements = await Fetch.aggregate([
            {
                $match: {
                    date: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            { $unwind: "$services" },
            {
                $match: {
                    "services.stylist2": { $ne: null }
                }
            },
            {
                $group: {
                    _id: "$services.stylist2",
                    totalAchieved: { $sum: { $multiply: ["$services.price", 0.3] } } // 30% for secondary stylist
                }
            }
        ]);

        // Combine achievements
        const combinedAchievements = new Map();
        achievements.forEach(ach => {
            combinedAchievements.set(ach._id, ach.totalAchieved);
        });

        secondaryAchievements.forEach(ach => {
            const currentTotal = combinedAchievements.get(ach._id) || 0;
            combinedAchievements.set(ach._id, currentTotal + ach.totalAchieved);
        });

        // Update achievements in EmployeeTarget collection
        for (const [stylistName, totalAchieved] of combinedAchievements) {
            const staff = await Staff.findOne({ name: stylistName });
            if (staff) {
                await EmployeeTarget.findOneAndUpdate(
                    {
                        employeeId: staff._id,
                        month: currentMonth,
                        year: currentYear
                    },
                    {
                        $set: { achieved: Math.round(totalAchieved) }
                    },
                    { upsert: true }
                );
            }
        }

        // Fetch the updated employee targets
        const employeeTargets = await EmployeeTarget.find({
            month: currentMonth,
            year: currentYear
        }).populate('employeeId');

        res.render('employeeTargets', { staffMembers, employeeTargets });
    } catch (error) {
        console.error('Error fetching employee targets:', error);
        res.status(500).send('Error loading the employee targets page.');
    }
});

// Route to set employee target
app.post('/set-employee-target', async (req, res) => {
    try {
        const { employeeId, target } = req.body;
        const currentMonth = new Date().toLocaleString('default', { month: 'short' });
        const currentYear = new Date().getFullYear();

        let employeeTarget = await EmployeeTarget.findOne({
            employeeId,
            month: currentMonth,
            year: currentYear
        });

        if (employeeTarget) {
            employeeTarget.target = target;
            await employeeTarget.save();
        } else {
            // For new targets, get current month's achievement
            const startDate = new Date(currentYear, new Date().getMonth(), 1);
            const endDate = new Date(currentYear, new Date().getMonth() + 1, 0);

            const staff = await Staff.findById(employeeId);
            if (!staff) {
                throw new Error('Staff member not found');
            }

            // Calculate primary stylist achievements
            const primaryAchievement = await Fetch.aggregate([
                {
                    $match: {
                        date: { $gte: startDate, $lte: endDate },
                        "services.stylist": staff.name
                    }
                },
                { $unwind: "$services" },
                {
                    $match: {
                        "services.stylist": staff.name
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAchieved: { $sum: { 
                            $cond: [
                                { $eq: ["$services.stylist2", null] },
                                "$services.price",
                                { $multiply: ["$services.price", 0.7] }
                            ]
                        }}
                    }
                }
            ]);

            // Calculate secondary stylist achievements
            const secondaryAchievement = await Fetch.aggregate([
                {
                    $match: {
                        date: { $gte: startDate, $lte: endDate },
                        "services.stylist2": staff.name
                    }
                },
                { $unwind: "$services" },
                {
                    $match: {
                        "services.stylist2": staff.name
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAchieved: { $sum: { $multiply: ["$services.price", 0.3] } }
                    }
                }
            ]);

            const totalAchieved = Math.round(
                (primaryAchievement[0]?.totalAchieved || 0) +
                (secondaryAchievement[0]?.totalAchieved || 0)
            );

            employeeTarget = new EmployeeTarget({
                employeeId,
                month: currentMonth,
                year: currentYear,
                target,
                achieved: totalAchieved
            });
            await employeeTarget.save();
        }

        res.status(200).json({ message: 'Employee target set successfully' });
    } catch (error) {
        console.error('Error setting employee target:', error);
        res.status(500).json({ message: 'Error setting employee target' });
    }
});

// Route to update employee achievements
app.post('/update-employee-achievements', async (req, res) => {
    try {
        const currentMonth = new Date().toLocaleString('default', { month: 'short' });
        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear, new Date().getMonth(), 1);
        const endDate = new Date(currentYear, new Date().getMonth() + 1, 0);

        // Get all staff members
        const staffMembers = await Staff.find({});
        
        for (const staff of staffMembers) {
            // Calculate primary stylist achievements
            const primaryAchievement = await Fetch.aggregate([
                {
                    $match: {
                        date: { $gte: startDate, $lte: endDate },
                        "services.stylist": staff.name
                    }
                },
                { $unwind: "$services" },
                {
                    $match: {
                        "services.stylist": staff.name
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAchieved: { $sum: { 
                            $cond: [
                                { $eq: ["$services.stylist2", null] },
                                "$services.price",
                                { $multiply: ["$services.price", 0.7] }
                            ]
                        }}
                    }
                }
            ]);

            // Calculate secondary stylist achievements
            const secondaryAchievement = await Fetch.aggregate([
                {
                    $match: {
                        date: { $gte: startDate, $lte: endDate },
                        "services.stylist2": staff.name
                    }
                },
                { $unwind: "$services" },
                {
                    $match: {
                        "services.stylist2": staff.name
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAchieved: { $sum: { $multiply: ["$services.price", 0.3] } }
                    }
                }
            ]);

            const totalAchieved = Math.round(
                (primaryAchievement[0]?.totalAchieved || 0) +
                (secondaryAchievement[0]?.totalAchieved || 0)
            );

            // Update or create employee target
            await EmployeeTarget.findOneAndUpdate(
                {
                    employeeId: staff._id,
                    month: currentMonth,
                    year: currentYear
                },
                {
                    $set: { achieved: totalAchieved }
                },
                { upsert: true }
            );
        }

        res.status(200).json({ message: 'Employee achievements updated successfully' });
    } catch (error) {
        console.error('Error updating employee achievements:', error);
        res.status(500).json({ message: 'Error updating employee achievements' });
    }
});

// Route to fetch all staff members
app.get('/staff', async (req, res) => {
    try {
        const staffMembers = await Staff.find({});
        res.render('staff', { staffMembers });
    } catch (err) {
        console.error('Error fetching staff members:', err);
        res.status(500).send('Error fetching staff members');
    }
});

// Route to handle adding new staff
app.post('/add-staff', upload.single('aadhaarPhoto'), async (req, res) => {
    const { 
        name, 
        email,
        birthdate, 
        contactNumber, 
        gender, 
        address, 
        jobTitle, 
        employmentStartDate, 
        aadhaarId 
    } = req.body;
    
    const aadhaarPhoto = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;
    
    try {
        const newStaff = new Staff({
            name,
            email,
            birthdate,
            contactNumber,
            gender,
            address,
            jobTitle,
            employmentStartDate,
            aadhaarId,
            aadhaarPhoto
        });
        await newStaff.save();

        // Send email notification using nodemailer
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'nobleevergreen2024@gmail.com',
                pass: 'pmgz dgxu uizj umwy' // Use an App Password, not your Gmail password
            }
        });

        const mailOptions = {
            from: 'nobleevergreen2024@gmail.com',
            to: 'raguld2105@gmail.com',
            subject: 'New Staff Added',
            html: `
                <h2>New Staff Member Added</h2>
                <ul>
                    <li><strong>Name:</strong> ${name}</li>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Birthdate:</strong> ${birthdate}</li>
                    <li><strong>Contact Number:</strong> ${contactNumber}</li>
                    <li><strong>Gender:</strong> ${gender}</li>
                    <li><strong>Address:</strong> ${address}</li>
                    <li><strong>Job Title:</strong> ${jobTitle}</li>
                    <li><strong>Employment Start Date:</strong> ${employmentStartDate}</li>
                    <li><strong>Aadhaar ID:</strong> ${aadhaarId}</li>
                </ul>
            `
        };

        await transporter.sendMail(mailOptions); 

        res.redirect("/staff");
    } catch (err) {
        console.log(err);
        res.status(500).send('Error adding staff member');
    }
});

// Route to update staff details
app.post('/update-staff', async (req, res) => {
    const { id, name, contactNumber, jobTitle, employmentStartDate } = req.body;
    try {
        await Staff.findByIdAndUpdate(id, {
            name,
            contactNumber,
            jobTitle,
            employmentStartDate
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating staff member:', err);
        res.status(500).send('Error updating staff members');
    }
});

// Route to delete a staff member
app.post('/delete-staff', async (req, res) => {
    try {
        await Staff.findByIdAndDelete(req.body.id);
        res.redirect("/staff");
    } catch (err) {
        console.error('Error deleting staff member:', err);
        res.status(500).send('Error deleting staff members');
    }
});

app.get("/inventory", async (req, res) => {
    const products = await Product.find();
    res.render("inventory", { products });
});

// Route to add a new product
app.post("/inventory", async (req, res) => {
    const { productName, productPrice, stocksPurchased, stocksInInventory } = req.body;
    await Product.create({ productName, productPrice, stocksPurchased, stocksInInventory });
    res.redirect("/inventory");
});

// Route to edit an item in the inventory
app.post("/edit-item", async (req, res) => {
    const { id, productName, productPrice, stocksPurchased, stocksInInventory } = req.body;
    try {
        await Product.findByIdAndUpdate(id, { productName, productPrice, stocksPurchased, stocksInInventory });
        res.redirect("/inventory");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Route to delete an item from the inventory
app.post("/delete-item", async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.body.id);
        res.redirect("/inventory");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get('/export', (req, res) => {
    const defaultFromDate = new Date();
    const defaultToDate = new Date();
    
    // Set the default date range to be the last 30 days
    defaultFromDate.setDate(defaultFromDate.getDate() - 30);

    // Initial render with no billing data
    // Add stylist1 and stylist2 columns to the table header for the EJS template
    res.render('export', { 
        billingData: null, 
        fromDate: defaultFromDate.toISOString().split('T')[0], 
        toDate: defaultToDate.toISOString().split('T')[0],
        tableHeaders: [
            'Customer Name',
            'Number',
            'Date',
            'Stylist 1',
            'Stylist 2',
            'Service',
            'Price'
        ]
    });
});

app.get('/topemployees', async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        // Fixed week calculation
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Start from Monday
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const topOfDay = await Fetch.aggregate([
            { $match: { date: { $gte: startOfDay, $lt: endOfDay } } },
            { $unwind: "$services" },
            { $group: { _id: "$services.stylist", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);


        const topOfWeek = await Fetch.aggregate([
            { $match: { date: { $gte: startOfWeek, $lt: endOfWeek } } },
            { $unwind: "$services" },
            { $group: { _id: "$services.stylist", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        const topOfMonth = await Fetch.aggregate([
            { $match: { date: { $gte: startOfMonth, $lt: endOfMonth } } },
            { $unwind: "$services" },
            { $group: { _id: "$services.stylist", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        res.render('topemployees', { topOfDay, topOfWeek, topOfMonth });
    } catch (error) {
        console.error('Error fetching top employees:', error);
        res.status(500).send('Error fetching top employees');
    }
});

app.get('/top-stylists', async (req, res) => {
    const { period } = req.query;
    const today = new Date();
    let start, end;

    switch (period) {
        case 'day':
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
            break;
        case 'week':
            start = new Date(today);
            start.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Start from Monday
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(start.getDate() + 7);
            break;
        case 'month':
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        default:
            return res.status(400).json({ error: "Invalid period specified" });
    }

    try {
        const topStylists = await Fetch.aggregate([
            { $match: { date: { $gte: start, $lt: end } } },
            { $unwind: "$services" },
            { $group: { _id: "$services.stylist", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 3 }
        ]);

        res.json(topStylists);
    } catch (error) {
        console.error('Error fetching top stylists:', error);
        res.status(500).send('Error fetching top stylists');
    }
});


// Get product billing page
app.get("/productbill", async (req, res) => {
    try {
        const products = await Product.find({});
        res.render("productbill", { products });
    } catch (error) {
        res.status(500).send("Error loading product billing page");
    }
});

// API endpoint to get all products
app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find({}, 'productName productPrice');
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Handle product bill submission
app.post("/productbill", async (req, res) => {
    try {
        const {
            customer_name,
            customer_number,
            date,
            gender,
            subtotal,
            discountType,
            discount,
            grandTotal,
            paymentMethod
        } = req.body;

        // Parse products array from request body
        let products = [];
        if (Array.isArray(req.body.products)) {
            products = req.body.products;
        } else if (typeof req.body.products === 'string') {
            // If sent as JSON string
            products = JSON.parse(req.body.products);
        } else {
            // If sent as products1, products2, etc.
            let index = 1;
            while (req.body[`products${index}`]) {
                products.push({
                    name: req.body[`products${index}`],
                    price: parseFloat(req.body[`prices${index}`]) || 0,
                    quantity: parseInt(req.body[`quantities${index}`]) || 0,
                    total: (parseFloat(req.body[`prices${index}`]) || 0) * (parseInt(req.body[`quantities${index}`]) || 0)
                });
                index++;
            }
        }

        // Save bill to DB as you already do...
        await ProductBill.create({
            customer_name,
            customer_number,
            date,
            gender,
            products,
            subtotal,
            discountType,
            discount,
            grandTotal,
            paymentMethod
        });

        // --- PDF Generation ---
        const PDFDocument = require('pdfkit');
        const { Readable } = require('stream');
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', async () => {
            const pdfBuffer = Buffer.concat(chunks);

            // --- WhatsApp Notification ---
            const chatId = `91${customer_number}@c.us`;
            const bufferStream = new Readable();
            bufferStream.push(pdfBuffer);
            bufferStream.push(null);

            const form = new FormData();
            form.append('chatId', chatId);
            form.append('file', bufferStream, {
                filename: `Noble_Evergreen_Unisex_Salon.pdf`,
                contentType: 'application/pdf'
            });
            form.append('caption', `Dear ${customer_name}, thank you for your purchase at Noble Evergreen Salon. Please find your product bill attached.`);

            try {
                await axios.post(
                    `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/sendFileByUpload/${GREEN_API_TOKEN}`,
                    form,
                    { headers: form.getHeaders() }
                );
            } catch (err) {
                console.error('WhatsApp send error:', err?.response?.data || err.message);
            }

            res.json({
                success: true,
                message: 'Product bill generated and PDF sent via WhatsApp'
            });
        });

        // --- PDF Content ---
        const address = 'Leelavathi Achaer Complex Opp. Muthoot Finance Immadihalli Main Road, Hagadur, Whitefiled, Bangalore - 560066';
        doc
            .rect(0, 0, doc.page.width, 80)
            .fill('#8DBE50')
            .fillColor('black')
            .fontSize(24)
            .font('Helvetica-Bold')
            .text('NOBLE EVERGREEN UNISEX SALON', { align: 'center' })
            .moveDown(0.5)
            .fontSize(10)
            .font('Helvetica')
            .text(address, { align: 'center' })
            .moveDown(1);

        doc
            .moveDown(0.5)
            .fontSize(14)
            .font('Helvetica-Bold')
            .text('PRODUCT BILL', { align: 'right' })
            .fontSize(10)
            .font('Helvetica')
            .text(`Date: ${date}`, { align: 'right' })
            .moveDown(1);

        doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Customer Details')
            .font('Helvetica')
            .fontSize(11)
            .text(`Name: ${customer_name}`)
            .text(`Phone Number: ${customer_number}`)
            .text(`Gender: ${gender}`)
            .moveDown(0.5);

        // Products Table
        doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Products')
            .moveDown(0.2);

        const tableTop = doc.y + 5;
        const colX = [doc.page.margins.left, 270, 370, 470];
        doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('Product Name', colX[0], tableTop)
            .text('Price', colX[1], tableTop)
            .text('Quantity', colX[2], tableTop)
            .text('Total', colX[3], tableTop);

        doc
            .moveTo(colX[0], tableTop + 15)
            .lineTo(doc.page.width - doc.page.margins.right, tableTop + 15)
            .strokeColor('#ddd')
            .lineWidth(1)
            .stroke();

        let rowY = tableTop + 20;
        doc.font('Helvetica');
        (products || []).forEach(product => {
            doc.text(product.name, colX[0], rowY)
                .text(`Rs.${parseFloat(product.price).toFixed(2)}`, colX[1], rowY)
                .text(product.quantity, colX[2], rowY)
                .text(`Rs.${parseFloat(product.total).toFixed(2)}`, colX[3], rowY);
            rowY += 18;
        });

        // Totals Section
        doc.moveDown(2)
            .fontSize(12)
            .font('Helvetica-Bold');
        let y = doc.y;
        doc.text('Subtotal:', colX[2], y);
        doc.text(`Rs.${parseFloat(subtotal).toFixed(2)}`, colX[3], y, { align: 'right' });
        doc.moveDown(0.5);

        y = doc.y + 5;
        doc.text('Discount:', colX[2], y);
        doc.text(`Rs.${parseFloat(discount).toFixed(2)} (${discountType})`, colX[3], y, { align: 'right' });
        doc.moveDown(0.5);

        y = doc.y + 5;
        doc.text('Grand Total:', colX[2], y);
        doc.text(`Rs.${parseFloat(grandTotal).toFixed(2)}`, colX[3], y, { align: 'right' });

        doc.end();
    } catch (error) {
        console.error("Error creating product bill:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get product bill details
app.get("/api/product-bill/:id", async (req, res) => {
    try {
        const bill = await ProductBill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }
        res.json(bill);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all product bills
app.get("/api/product-bills", async (req, res) => {
    try {
        const bills = await ProductBill.find({})
            .sort({ createdAt: -1 })
            .select('customer_name date itemCount grandTotal');
        res.json(bills);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/export", async (req, res) => {
    const { fromDate, toDate, billType } = req.body;

    try {
        const query = {
            date: {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
            }
        };

        if (billType === "package") {
            query.billType = "package";
        } else if (billType === "service") {
            query.billType = "service";
        }

        const data = await Fetch.find(query);

        if (data.length === 0) {
            return res.status(404).send("No records found for the selected date range.");
        }

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A3', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="billing_data.pdf"');
        doc.pipe(res);

        // Title
        const address = 'Leelavathi Achaer Complex Opp. Muthoot Finance Immadihalli Main Road, Hagadur, Whitefiled, Bangalore - 560066';
        doc.rect(0, 0, doc.page.width, 60).fill('#8DBE50');
        doc.fillColor('black')
            .fontSize(22)
            .font('Helvetica-Bold')
            .text('NOBLE EVERGREEN UNISEX SALON', 0, 18, { align: 'center' })
            .moveDown(0.2)
            .fontSize(11)
            .font('Helvetica')
            .text(address, { align: 'center' })
            .moveDown(1);
        doc.moveDown(1);
        
        doc.fillColor('black')
            .fontSize(14)
            .font('Helvetica')
            .text('Billing Records', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(11)
            .text(`From: ${fromDate}   To: ${toDate}   Type: ${billType}`, { align: 'center' });
        doc.moveDown(1);

        // Table columns and centering
        const colWidths = [140, 90, 90, 90, 90, 80, 70];
        const rowHeight = 20;
        const tableWidth = colWidths.reduce((a, b) => a + b, 0);
        const tableStartX = (doc.page.width - tableWidth) / 2;
        const colX = [
            tableStartX,
            tableStartX + colWidths[0],
            tableStartX + colWidths[0] + colWidths[1],
            tableStartX + colWidths[0] + colWidths[1] + colWidths[2],
            tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
            tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
            tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5]
        ];

        const tableTop = doc.y + 10;

        // Header background
        doc.rect(colX[0], tableTop, tableWidth, rowHeight)
            .fill('#c7dfbf');
        doc.fillColor('black')
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('Customer Name', colX[0] + 4, tableTop + 5, { width: colWidths[0] - 8 })
            .text('Number', colX[1] + 4, tableTop + 5, { width: colWidths[1] - 8 })
            .text('Date', colX[2] + 4, tableTop + 5, { width: colWidths[2] - 8 })
            .text('Stylist 1', colX[3] + 4, tableTop + 5, { width: colWidths[3] - 8 })
            .text('Stylist 2', colX[4] + 4, tableTop + 5, { width: colWidths[4] - 8 })
            .text('Service', colX[5] + 4, tableTop + 5, { width: colWidths[5] - 8 })
            .text('Price', colX[6] + 4, tableTop + 5, { width: colWidths[6] - 8 });

        // Draw header borders
        let y = tableTop;
        doc.moveTo(colX[0], y).lineTo(colX[0] + tableWidth, y).stroke('#aad381');
        doc.moveTo(colX[0], y + rowHeight).lineTo(colX[0] + tableWidth, y + rowHeight).stroke('#aad381');
        for (let i = 0; i < colX.length; i++) {
            doc.moveTo(colX[i], y).lineTo(colX[i], y + rowHeight).stroke('#aad381');
        }
        doc.moveTo(colX[colX.length - 1] + colWidths[colWidths.length - 1], y)
            .lineTo(colX[colX.length - 1] + colWidths[colWidths.length - 1], y + rowHeight)
            .stroke('#aad381');

        // Table rows
        y += rowHeight;
        doc.font('Helvetica').fontSize(10);

        // Flatten all services for all bills
        const allRows = [];
        data.forEach(bill => {
            (bill.services || []).forEach(service => {
                allRows.push({
                    customer_name: bill.customer_name,
                    customer_number: bill.customer_number,
                    date: bill.date ? new Date(bill.date).toISOString().split('T')[0] : '',
                    stylist1: service.stylist || '-',
                    stylist2: service.stylist2 || '-',
                    service: service.name,
                    price: service.price
                });
            });
        });

        // Pagination logic
        const maxY = doc.page.height - doc.page.margins.bottom - rowHeight;
        for (let idx = 0; idx < allRows.length; idx++) {
            const row = allRows[idx];
            // Alternate row color
            if (idx % 2 === 0) {
                doc.rect(colX[0], y, tableWidth, rowHeight).fill('#f4f4f9');
                doc.fillColor('black');
            } else {
                doc.fillColor('black');
            }
            doc.font('Helvetica').fontSize(10); // Ensure normal font for rows
            doc.text(row.customer_name || '', colX[0] + 4, y + 5, { width: colWidths[0] - 8 });
            doc.text(row.customer_number || '', colX[1] + 4, y + 5, { width: colWidths[1] - 8 });
            doc.text(row.date || '', colX[2] + 4, y + 5, { width: colWidths[2] - 8 });
            doc.text(row.stylist1 || '-', colX[3] + 4, y + 5, { width: colWidths[3] - 8 });
            doc.text(row.stylist2 || '-', colX[4] + 4, y + 5, { width: colWidths[4] - 8 });
            doc.text(row.service || '', colX[5] + 4, y + 5, { width: colWidths[5] - 8 });
            doc.text(`Rs.${row.price?.toFixed(2) || '0.00'}`, colX[6] + 4, y + 5, { width: colWidths[6] - 8 });

            // Draw row borders
            doc.moveTo(colX[0], y).lineTo(colX[0] + tableWidth, y).stroke('#aad381');
            doc.moveTo(colX[0], y + rowHeight).lineTo(colX[0] + tableWidth, y + rowHeight).stroke('#aad381');
            for (let i = 0; i < colX.length; i++) {
                doc.moveTo(colX[i], y).lineTo(colX[i], y + rowHeight).stroke('#aad381');
            }
            doc.moveTo(colX[colX.length - 1] + colWidths[colWidths.length - 1], y)
                .lineTo(colX[colX.length - 1] + colWidths[colWidths.length - 1], y + rowHeight)
                .stroke('#aad381');

            y += rowHeight;

            // Add new page if needed
            if (y > maxY && idx < allRows.length - 1) {
                doc.addPage();
                y = doc.y;
                // Redraw header on new page
                doc.rect(colX[0], y, tableWidth, rowHeight)
                    .fill('#c7dfbf');
                doc.fillColor('black')
                    .fontSize(11)
                    .font('Helvetica-Bold')
                    .text('Customer Name', colX[0] + 4, y + 5, { width: colWidths[0] - 8 })
                    .text('Number', colX[1] + 4, y + 5, { width: colWidths[1] - 8 })
                    .text('Date', colX[2] + 4, y + 5, { width: colWidths[2] - 8 })
                    .text('Stylist 1', colX[3] + 4, y + 5, { width: colWidths[3] - 8 })
                    .text('Stylist 2', colX[4] + 4, y + 5, { width: colWidths[4] - 8 })
                    .text('Service', colX[5] + 4, y + 5, { width: colWidths[5] - 8 })
                    .text('Price', colX[6] + 4, y + 5, { width: colWidths[6] - 8 });
                // Draw header borders
                doc.moveTo(colX[0], y).lineTo(colX[0] + tableWidth, y).stroke('#aad381');
                doc.moveTo(colX[0], y + rowHeight).lineTo(colX[0] + tableWidth, y + rowHeight).stroke('#aad381');
                for (let i = 0; i < colX.length; i++) {
                    doc.moveTo(colX[i], y).lineTo(colX[i], y + rowHeight).stroke('#aad381');
                }
                doc.moveTo(colX[colX.length - 1] + colWidths[colWidths.length - 1], y)
                    .lineTo(colX[colX.length - 1] + colWidths[colWidths.length - 1], y + rowHeight)
                    .stroke('#aad381');
                y += rowHeight;
                doc.font('Helvetica').fontSize(10); // Set font back to normal for rows
            }
        }

        doc.end();
    } catch (error) {
        console.error("Error exporting data:", error);
        res.status(500).send("Internal server error");
    }
});

app.listen(port, () => {
    console.log(`Server is running on ${port}`);
});

