import connection from "../config/connectDB";
import jwt from 'jsonwebtoken'
import md5 from "md5";
import request from 'request';
import e from "express";
require('dotenv').config();

let timeNow = Date.now();

const randomString = (length) => {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}


const randomNumber = (min, max) => {
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

const isNumber = (params) => {
    let pattern = /^[0-9]*\d$/;
    return pattern.test(params);
}

const ipAddress = (req) => {
    let ip = '';
    if (req.headers['x-forwarded-for']) {
        ip = req.headers['x-forwarded-for'].split(",")[0];
    } else if (req.connection && req.connection.remoteAddress) {
        ip = req.connection.remoteAddress;
    } else {
        ip = req.ip;
    }
    return ip;
}

const timeCreate = () => {
    const d = new Date();
    const time = d.getTime();
    return time;
}

const loginPage = async (req, res) => {
    return res.render("account/login.ejs");
}

const registerPage = async (req, res) => {
    return res.render("account/register.ejs");
}

const forgotPage = async (req, res) => {
    return res.render("account/forgot.ejs");
}

const login = async (req, res) => {
    let { username, pwd } = req.body;

    if (!username || !pwd || !username) {//!isNumber(username)
        return res.status(200).json({
            message: 'ERROR!!!'
        });
    }

    try {
        const [rows] = await connection.query('SELECT * FROM users WHERE phone = ? AND password = ? ', [username, md5(pwd)]);
        if (rows.length == 1) {
            if (rows[0].status == 1) {
                const { password, money, ip, veri, ip_address, status, time, ...others } = rows[0];
                const accessToken = jwt.sign({
                    user: { ...others },
                    timeNow: timeNow
                }, process.env.JWT_ACCESS_TOKEN, { expiresIn: "1d" });
                await connection.execute('UPDATE `users` SET `token` = ? WHERE `phone` = ? ', [md5(accessToken), username]);
                return res.status(200).json({
                    message: 'Login Sucess',
                    status: true,
                    token: accessToken,
                    value: md5(accessToken)
                });
            } else {
                return res.status(200).json({
                    message: 'Account has been locked',
                    status: false
                });
            }
        } else {
            return res.status(200).json({
                message: 'Incorrect Username or Password',
                status: false
            });
        }
    } catch (error) {
        if (error) console.log(error);
    }

}

const register = async (req, res) => {
    try {
        let { username, pwd, invitecode } = req.body;

        // Validation checks for username, pwd, invitecode
        if (!username || !pwd || !invitecode || username.length < 9 || username.length > 10 || !isNumber(username)) {
            return res.status(200).json({
                message: 'Invalid input',
                status: false
            });
        }

        const [check_u] = await connection.query('SELECT * FROM users WHERE phone = ?', [username]);
        const [check_i] = await connection.query('SELECT * FROM users WHERE code = ?', [invitecode]);
        const [check_ip] = await connection.query('SELECT * FROM users WHERE ip_address = ?', [ipAddress(req)]);

        let invitecode1 = (check_i.length === 1) ? invitecode : "6fGGw42409";

        if (check_u.length === 1 && check_u[0].veri === 1) {
            return res.status(200).json({
                message: 'Phone number already registered',
                status: false
            });
        }

        const [rows] = await connection.query('SELECT * FROM users WHERE `phone` = ?', [username]);
        if (rows.length === 0) {
            // Proceed with registration
            let id_user = randomNumber(10000, 99999);
            let name_user = "Member" + randomNumber(10000, 99999);
            let code = randomString(5) + randomNumber(10000, 99999);
            let ip = ipAddress(req);
            let time = timeCreate();
            let ctv = (check_i[0].level === 2) ? check_i[0].phone : check_i[0].ctv;

            if (check_ip.length <= 3) {
                const deletesql = "DELETE FROM users WHERE `users`.`phone` = ?";
                await connection.execute(deletesql, [username]);

                const sql = "INSERT INTO users SET id_user = ?,phone = ?,name_user = ?,password = ?,money = ?,code = ?,invite = ?,ctv = ?,veri = ?,ip_address = ?,status = ?,time = ?";
                await connection.execute(sql, [id_user, username, name_user, md5(pwd), 50, code, invitecode1, ctv, 1, ip, 1, time]);

                await connection.execute('INSERT INTO point_list SET phone = ?', [username]);
                return res.status(200).json({
                    message: 'Registration Success',
                    status: true
                });
            } else {
                return res.status(200).json({
                    message: 'Registered IP address limit reached',
                    status: false
                });
            }
        } else {
            return res.status(200).json({
                message: 'User already exists',
                status: false
            });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Internal Server Error',
            status: false
        });
    }
};

const verifyCode = async (req, res) => {
    let phone = req.body.phone;
    let now = new Date().getTime();
    let timeEnd = (+new Date) + 1000 * (60 * 2 + 0) + 500;
    let otp = randomNumber(100000, 999999);
    console.log("oasfdhode");
    if (phone.length < 9 || phone.length > 10 || !isNumber(phone)) {
        return res.status(200).json({
            message: 'phone error',
            status: false
        });
    }

    const [rows] = await connection.query('SELECT * FROM users WHERE `phone` = ?', [phone]);
    if (rows.length == 0) {
        await request(`https://www.fast2sms.com/dev/bulkV2?authorization=a6ZbKL8XyIp1cWSiBRg54vhV9DetUujdHENT7oM3nfxqAQw2OFgV5KxyH1iwkGoAB3JSWQh7lEbm8rM6&variables_values=${otp}&route=otp&numbers=${phone}`, async (error, response, body) => {
            let data = JSON.parse(body);
            console.log(data.message);
            if (data.message == 'SMS sent successfully.') {
                await connection.execute("INSERT INTO users SET phone = ?, otp = ?, veri = 0, time_otp = ? ", [phone, otp, timeEnd]);
                return res.status(200).json({
                    message: 'SMS sent sucessfully',
                    status: true,
                    timeStamp: timeNow,
                    timeEnd: timeEnd,
                });
            }
        });
    } else {
        let user = rows[0];
        if (user.time_otp - now <= 0) {
            request(`https://www.fast2sms.com/dev/bulkV2?authorization=a6ZbKL8XyIp1cWSiBRg54vhV9DetUujdHENT7oM3nfxqAQw2OFgV5KxyH1iwkGoAB3JSWQh7lEbm8rM6&variables_values=${otp}&route=otp&numbers=${phone}`, async (error, response, body) => {
                let data = JSON.parse(body);
                if (data.message == 'SMS sent successfully.') {
                    await connection.execute("UPDATE users SET otp = ?, time_otp = ? WHERE phone = ? ", [otp, timeEnd, phone]);
                    return res.status(200).json({
                        message: 'Submitted successfully',
                        status: true,
                        timeStamp: timeNow,
                        timeEnd: timeEnd,
                    });
                }
            });
        } else {
            return res.status(200).json({
                message: 'Send SMS regularly',
                status: false,
                timeStamp: timeNow,
            });
        }
    }

}

const verifyCodePass = async (req, res) => {
    let phone = req.body.phone;
    let now = new Date().getTime();
    let timeEnd = (+new Date) + 1000 * (60 * 2 + 0) + 500;
    let otp = randomNumber(100000, 999999);

    if (phone.length < 9 || phone.length > 10 || !isNumber(phone)) {
        return res.status(200).json({
            message: 'phone error',
            status: false
        });
    }

    const [rows] = await connection.query('SELECT * FROM users WHERE `phone` = ? AND veri = 1', [phone]);
    if (rows.length == 0) {
        return res.status(200).json({
            message: 'Account does not exist',
            status: false,
            timeStamp: timeNow,
        });
    } else {
        let user = rows[0];
        if (user.time_otp - now <= 0) {
            request(`https://www.fast2sms.com/dev/bulkV2?authorization=a6ZbKL8XyIp1cWSiBRg54vhV9DetUujdHENT7oM3nfxqAQw2OFgV5KxyH1iwkGoAB3JSWQh7lEbm8rM6&variables_values=${otp}&route=otp&numbers=${phone}`, async (error, response, body) => {
                let data = JSON.parse(body);
                if (data.message == 'SMS sent successfully.') {
                    await connection.execute("UPDATE users SET otp = ?, time_otp = ? WHERE phone = ? ", [otp, timeEnd, phone]);
                    return res.status(200).json({
                        message: 'Submitted successfully',
                        status: true,
                        timeStamp: timeNow,
                        timeEnd: timeEnd,
                    });
                }
            });
        } else {
            return res.status(200).json({
                message: 'Send SMS regularly',
                status: false,
                timeStamp: timeNow,
            });
        }
    }

}

const forGotPassword = async (req, res) => {
    let username = req.body.username;
    let otp = req.body.otp;
    let pwd = req.body.pwd;
    let now = new Date().getTime();
    let timeEnd = (+new Date) + 1000 * (60 * 2 + 0) + 500;
    let otp2 = randomNumber(100000, 999999);

    if (username.length < 9 || username.length > 10 || !isNumber(username)) {
        return res.status(200).json({
            message: 'phone error',
            status: false
        });
    }

    const [rows] = await connection.query('SELECT * FROM users WHERE `phone` = ? AND veri = 1', [username]);
    if (rows.length == 0) {
        return res.status(200).json({
            message: 'Account does not exist',
            status: false,
            timeStamp: timeNow,
        });
    } else {
        let user = rows[0];
        if (user.time_otp - now > 0) {
            if (user.otp == otp) {
                await connection.execute("UPDATE users SET password = ?, otp = ?, time_otp = ? WHERE phone = ? ", [md5(pwd), otp2, timeEnd, username]);
                return res.status(200).json({
                    message: 'Change password successfully',
                    status: true,
                    timeStamp: timeNow,
                    timeEnd: timeEnd,
                });
            } else {
                return res.status(200).json({
                    message: 'OTP code is incorrect',
                    status: false,
                    timeStamp: timeNow,
                });
            }
        } else {
            return res.status(200).json({
                message: 'OTP code has expired',
                status: false,
                timeStamp: timeNow,
            });
        }
    }

}




module.exports = {
    login,
    register,
    loginPage,
    registerPage,
    forgotPage,
    verifyCode,
    verifyCodePass,
    forGotPassword
}