import {Outlet} from "react-router-dom";

const LayoutPage = () => {
    return <>
        <h2>LayoutPage</h2>
        <Outlet/>
    </>;
};

export default LayoutPage