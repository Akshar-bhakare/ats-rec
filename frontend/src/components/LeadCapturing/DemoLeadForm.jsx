import { useCallback, useMemo, useState } from "react";
import {
    Box,
    Typography,
} from "@mui/material";
import { Link } from "react-router-dom";

import MUICreateForm from "../MUI/CommonCRUD/MUICreateForm";
import countryList from '../../assets/CountryCodes.json';
import { useAuthContextState } from "../../contexts/AuthContext";
import { useCallSimulationContextState } from "../../contexts/CallSimulationContext";



function DemoLeadForm(props) {
    const [, setAuthState] = useAuthContextState();
    const [, setCallState] = useCallSimulationContextState();
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        mobile: "",
        countryCode: "+91",
        email: "",
        company: "",
    });
    const freeDomains = [
        "gmail.com",
        "yahoo.com",
        "outlook.com",
        "hotmail.com",
        "aol.com",
        "icloud.com",
        "protonmail.com",
        "zoho.com",
        "gmx.com",
        "yandex.com",
        "mail.com",
        "live.com",
        "msn.com",
        "me.com",
        "inbox.com",
        "fastmail.com",
        "tutanota.com",
        "mail.ru",
        "yahoo.co.uk",
        "yahoo.co.in",
        "rediffmail.com",
        "qq.com",
        "naver.com",
        "daum.net",
        "hanmail.net"
    ];

    const handleChange = useCallback((e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

        e?.target?.name === "firstName" && setCallState({
            aiCallDemoCandidateFirstName: e.target.value,
        });
        if (["AI Screening Call"].includes(props?.demoOf) && e?.target?.name === "email") {
            setAuthState({
                booleanSubmitEmail: e.target.value,
            });
        }

    }, [props?.demoOf, setAuthState, setCallState]);

    const isFreeEmail = (email) => {
        const domain = email.split("@")[1];
        if (!email || freeDomains.includes(domain)) {
            return true;
        }
        return false;
    };



    const [currAction, setCurrAction] = useState("getEmail");

    const currSubmitUrl = useMemo(() => {
        switch (currAction) {
            case "getOtp":
                props?.setSubmitBtnState?.(2);
                return "/api/demo/leads/email/verify/otp/";

            case "getNewPassword":
                props?.setSubmitBtnState?.(3);
                return "/api/demo/leads/email/new/"; // add trigger url

            default:
                props?.setSubmitBtnState?.(1);
                return "/api/demo/leads/email/send/otp/";
        }
    }, [currAction, props]);


    const extentedSubmit = useCallback(
        (ev = null, data = null) => {
            ev?.preventDefault?.();
            data?.action && setCurrAction(data?.action)
            if (data?.action === "getNewPassword") {
                props?.setSubmitBtnState?.(3);
                setAuthState({
                    booleanSubmitEmail: form.email,
                });
                props?.onSuccess?.(form.email);
            }
        },
        [props, setAuthState, form.email],
    )


    return (
        <Box sx={{ p: { xs: 2, sm: 3, md: 5 }, m: { xs: 2, sm: 3, md: 5 } }}>
            <MUICreateForm
                formCardOptions={{
                    component: "div",
                    sx: {
                        color: "",
                        minWidth: { xs: 280 - 60, sm: 300 - 60, md: 320 - 60 },
                        background: "transparent",
                    },
                }}
                formBoxOptions={{
                    sx: {
                        id: "id_demo_form",
                        color: "",
                        background: "transparent",
                        p: 0,
                        height: { xs: 300, sm: 340, md: 360 },
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-around",
                        gap: 2,
                        ...(props?.boxSx || {}),
                    }
                }}
                fields={[
                    ...(currAction === "getEmail" ? [
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
                        {
                            AutocompleteProps: {
                                options: countryList.map(c => ({ label: `${c.name} (${c.dial_code})`, value: c.dial_code })),
                                getOptionValue: opt => (typeof opt === 'string' ? opt : opt.value),
                            },
                            AutocompleteInputProps: {
                                label: "Country Code",
                                name: "countryCode",
                                type: "select",
                                required: true,
                            }
                        },
                        {
                            AutocompleteInputProps: {
                                type: "tel",
                                name: "phoneNumber",
                                label: "Mobile",
                                helperText: "Digits only.",
                                required: true,
                            }
                        },
                        {
                            AutocompleteInputProps: {
                                name: "email",
                                type: "email",
                                label: "Business Email",
                                autoComplete: "email",
                                error: form.email && isFreeEmail(form.email),
                                helperText: (form.email && isFreeEmail(form.email)) && "Please use business email-id...",
                                required: true
                            }
                        },
                        {
                            AutocompleteInputProps: {
                                name: "company",
                                type: "text",
                                label: "Company Name",
                                required: true
                            }
                        },

                        {
                            type: 'checkbox',
                            name: `concentToTermsAndConditions`,
                            label: (<Typography variant="caption" color="text.secondary" sx={{ textWrap: "stable" }}>
                                I accept the {" "}
                                <Link
                                    to="/termscondition/"
                                    style={{ color: "#1976d2", textDecoration: "none" }}
                                >
                                    Terms and Conditions
                                </Link>
                                .
                            </Typography>),
                            required: true,
                        },
                    ] :
                        (currAction === "getOtp" ? [{
                            AutocompleteInputProps: {
                                name: 'otp',
                                type: 'password',
                                label: 'One Time Password (OTP)',
                                required: true
                            },
                        },
                        {
                            getField: () => (
                                <Box width="100%" sx={{ display: "flex", flexGrow: 1, mb: 2, pb: 2, justifyContent: "center" }}>
                                    <Typography variant='caption' fontSize={"small"} color='grey' align="center">
                                        OTP Sent to your email, Please check...
                                    </Typography>
                                </Box>)
                        }] : []
                        )
                    ),
                    {
                        type: "submit",
                        id: "id_demo_form_submit_btn",
                        label: "Next",
                        disabled: form.email && isFreeEmail(form.email),
                        sx: ["AI Boolean Search String"].includes(props?.demoOf) ? {} : { display: "none", p: 0, m: 0, width: "0px !important", height: "0px !important", visibility: "hidden" },
                    },
                ]}
                submitUrl={currSubmitUrl}
                initialValuesDict={{
                    demoOf: props?.demoOf ?? "AI Screening Call",
                }}
                onChangeExtended={handleChange}
                onSubmitExtended={extentedSubmit}
                onSubmitErrorExtended={(err) => {
                    console.log(
                        "\n Demo Form err: ", err.message
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




        </Box>
    );
}





export default DemoLeadForm;
