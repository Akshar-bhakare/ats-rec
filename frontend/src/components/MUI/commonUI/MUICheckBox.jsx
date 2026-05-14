import { Checkbox } from "@mui/material";


const MUICheckBox = (props) => {
    return (
        <>
            <Checkbox {...props} defaultChecked={props?.value} /> {props.label || props.text}
        </>
    )
}

export default MUICheckBox;