import MUICreateForm from "./MUICreateForm";


const MUIUpdateForm = ({initialValuesDict, ...props}) => (
    <MUICreateForm initialValuesDict = {initialValuesDict} {...props} />
);

export default MUIUpdateForm;