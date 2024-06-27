import {Link} from "react-router-dom";

const IndexPage = () => {
    return (
        <div>
            <Link to="/about">跳转About</Link>
            <h1>Index Page</h1>
        </div>
    );
};

export default IndexPage;
