import React, { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate, Link } from 'react-router-dom';

import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm';
import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import { validatePasswordStrength } from '../../AppUtils/passwordValidation';

const ForgetOrChangePasswordForm = (props) => {
    const [currAction, setCurrAction] = useState("getEmail");
    const [passwordError, setPasswordError] = useState('');
    const navigate = useNavigate();

    const currSubmitUrl = useMemo(() => {
        switch (currAction) {
            case "getOtp":
                return "/api/auth/password/change/verify/otp/";

            case "getNewPassword":
                return "/api/auth/password/change/new/";

            default:
                return "/api/auth/password/change/send/otp/";
        }
    }, [currAction]);



    return (
        <MUICenterLayout>
            <MUICreateForm
                fields={[
                    {
                        type: 'label',
                        variant: 'h4',
                        value: props?.funcFor + ' Password',
                        align: 'center',
                        sx: { m: 3, mb: 5 },
                    },
                    currAction === "getEmail" ? {
                        AutocompleteInputProps: {
                            name: 'email',
                            type: 'email',
                            label: 'Email',
                            required: true,
                            sx: { mb: 2 },
                        },
                    } : {},
                    currAction === "getOtp" ? {
                        AutocompleteInputProps: {
                            name: 'otp',
                            type: 'password',
                            label: 'One Time Password (OTP)',
                            required: true
                        },
                    } : {},
                    currAction === "getOtp" ? {
                        getField: () => (
                            <Box width="100%" sx={{ display: "flex", flexGrow: 1, mb: 2, pb: 2, justifyContent: "center" }}>
                                <Typography variant='caption' fontSize={"small"} color='grey' align="center">
                                    OTP Sent to your email, Please check...
                                </Typography>
                            </Box>)
                    } : {},
                    currAction === "getNewPassword" ? {
                        AutocompleteInputProps: {
                            name: 'newPassword',
                            type: 'password',
                            label: 'New Password',
                            required: true,
                            sx: { mb: 2 },
                            error: Boolean(passwordError),
                            helperText: passwordError,
                        },
                    } : {},
                    currAction === "getNewPassword" ? {
                        AutocompleteInputProps: {
                            name: 'confirmPassword',
                            type: 'password',
                            label: 'Confirm Password',
                            required: true,
                            sx: { mb: 3 },
                        },
                    } : {},
                    {
                        type: "submit",
                        label: currAction === "getNewPassword" ? "Save Password" : "Next",
                    },
                    {
                        getField: () => (
                            <Typography align="center" sx={{ mt: 2 }}>
                                Back to{' '}
                                <Link to="/auth/login/" style={{ color: 'inherit' }}>
                                    Sign in
                                </Link>
                            </Typography>
                        ),
                    },
                ]}
                submitUrl={currSubmitUrl}
                onBeforeSubmit={({ formData }) => {
                    if (currAction === 'getNewPassword') {
                        const pw = formData.newPassword;
                        const { valid, message } = validatePasswordStrength(pw);
                        if (!valid) {
                            setPasswordError(message);
                            return false;
                        }
                        setPasswordError('');
                    }
                    return true;
                }}
                onSubmitExtended={(ev = null, data = null) => {
                    ev?.preventDefault?.();
                    console.log(
                        "Forgot Password data: ", data
                    );

                    data?.action && setCurrAction(data?.action)

                    if (data?.action === "success") {
                        navigate('/auth/login', {
                            state: { info: 'Your password has been reset. Please sign in.' },
                        });
                    }
                }}
                onSubmitErrorExtended={(err) => {
                    console.log(
                        "\n err: ", err.message
                    );
                    switch (currAction) {
                        case "getNewPassword":
                            setCurrAction("getNewPassword");
                            break;
                        case "getOtp":
                            setCurrAction("getEmail")
                            break;

                        default:
                            setCurrAction("getEmail")
                            break;
                    }

                }}
            />
        </MUICenterLayout>
    );
};

export default ForgetOrChangePasswordForm;
