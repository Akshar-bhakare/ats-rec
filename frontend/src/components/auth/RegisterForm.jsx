import { useState } from "react";
import { InputAdornment, Typography, TextField, Box } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { MenuItem } from "@mui/material";
import OtpModal from "./OtpModal";
import countryList from "../../assets/CountryCodes.json";
import MUICenterLayout from "../MUI/commonUI/MUICenterLayout";
import MUICreateForm from "../MUI/CommonCRUD/MUICreateForm";
import MUIInput from "../MUI/commonUI/MUIInput";
import MUIButton from "../MUI/commonUI/MUIButton";


const RegisterForm = ({ onSubmitSuccess }) => {
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        emailVerified: false,
        phoneCountryCode: "+91",
        phone: "",
        phoneVerified: false,
        password: "",
        confirm: "",
    });
    const [otpTarget, setOtpTarget] = useState(null);

    const navigate = useNavigate();

    const requestOtp = async (target) => {
        const payload =
            target === "email" ? { email: form.email } : { phone: form.phone };

        try {
            await fetch("/api/auth/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            setOtpTarget(target);
        } catch (err) {
            console.error("OTP request failed:", err);
        }
    };

    const confirmOtp = async (code) => {
        try {
            await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, target: otpTarget }),
            });
            setForm((p) => ({
                ...p,
                ...(otpTarget === "email" && { emailVerified: true }),
                ...(otpTarget === "phone" && { phoneVerified: true }),
            }));
        } catch (err) {
            console.error("OTP verification failed:", err);
        }
        setOtpTarget(null);
    };

    const otpAdornment = (target, verified) => (
        <InputAdornment position="end">
            <MUIButton
                variant="contained"
                size="small"
                sx={{ px: 1.5, whiteSpace: "nowrap" }}
                disabled={verified}
                onClick={() => requestOtp(target)}
            >
                {verified ? "Verified" : "Get OTP"}
            </MUIButton>
        </InputAdornment>
    );



    return (
        <>
            <MUICenterLayout>
                <MUICreateForm

                    formCardOptions={{
                        sx: {
                            minWidth: "25vw",
                        }
                    }}

                    fields={[
                        {
                            type: 'label',
                            variant: 'h4',
                            value: "Create New Account",
                            align: "center",
                            sx: { mb: 4 }
                        },
                        {
                            type: "row",
                            rowColFields: [
                                {
                                    AutocompleteInputProps: {
                                        name: "firstName",
                                        label: "First Name",
                                        required: true,
                                    }
                                },
                                {
                                    AutocompleteInputProps: {
                                        name: "lastName",
                                        label: "Last Name",
                                        required: true,
                                    }
                                },
                            ],
                        },
                        {
                            AutocompleteInputProps: {
                                name: "email",
                                type: "email",
                                label: "Email",
                                required: true,
                                slotProps: {
                                    input: {
                                        endAdornment:
                                            form.email && otpAdornment("email", form.emailVerified),
                                    }
                                },
                            }
                        },
                        {
                            getField: (valuesDict, onFieldChange) => <MUIInput

                                formData={valuesDict}

                                AutocompleteInputProps={{
                                    name: "phone",
                                    type: "tel",
                                    label: "Mobile number",
                                    value: valuesDict?.['phone'],
                                    onChange: onFieldChange,
                                    required: true,
                                    slotProps: {
                                        input: {
                                            startAdornment:
                                                <InputAdornment position="start">
                                                    <TextField
                                                        select
                                                        size="small"
                                                        name="phoneCountryCode"
                                                        value={valuesDict?.phoneCountryCode || '+91'}
                                                        onChange={onFieldChange}
                                                        required={true}
                                                        sx={{
                                                            minWidth: 80,
                                                            "& .MuiSelect-select": { padding: "6px 8px" },
                                                        }}
                                                    >
                                                        {countryList.map((c) => (
                                                            <MenuItem
                                                                key={c.code}
                                                                value={c.dial_code}
                                                                sx={{ fontSize: "0.9rem", whiteSpace: "nowrap" }}
                                                            >
                                                                {c.name} ({c.dial_code})
                                                            </MenuItem>
                                                        ))}
                                                    </TextField>
                                                </InputAdornment>,

                                            endAdornment: form.phone && otpAdornment("phone", form.phoneVerified),
                                        }
                                    },
                                }}

                            />

                        },
                        {
                            AutocompleteInputProps: {
                                name: "password",
                                type: "password",
                                label: "Password",
                                required: true,
                            }
                        },
                        {
                            AutocompleteInputProps: {
                                name: "confirm",
                                type: "password",
                                label: "Confirm password",
                                required: true,
                            },
                        },
                        {
                            getField: () =>
                                <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
                                    <MUIButton type="submit" fullWidth>
                                        Sign-Up
                                    </MUIButton>
                                </Box>,

                        },
                        {
                            getField: () =>
                                <Typography align="center" sx={{ mt: 2 }}>
                                    Already a user? <Link to="/auth/login/">Login</Link>
                                </Typography>
                        }
                    ]}

                    submitUrl="/api/auth/register"

                    onSubmitExtended={(ev = null, data = null) => {
                        ev?.preventDefault?.();
                        data && 'id' in data && onSubmitSuccess?.(navigate);
                    }}

                />
            </MUICenterLayout>

            <OtpModal
                open={Boolean(otpTarget)}
                onClose={() => setOtpTarget(null)}
                onSubmit={confirmOtp}
                label={otpTarget === "email" ? "Email OTP" : "SMS OTP"}
            />
        </>
    );
};

export default RegisterForm;
