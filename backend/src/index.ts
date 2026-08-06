import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();


app.get("/health", (req, res) => {

    res.json({
        status : "ok"
    })

})


app.listen(process.env.PORT || 3000, () => {
     console.log(`server is running on port ${process.env.PORT || 3000}`);
});