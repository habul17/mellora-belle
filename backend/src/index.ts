import express from 'express'
import dotenv from 'dotenv'

dotenv.config();

const app = express();


app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    })
})


app.listen(process.env.PORT || 4000, () => {
    console.log(`Server Running On Port ${process.env.PORT || 4000}`);
})