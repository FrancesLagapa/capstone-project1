import React from "react";
import { Layout } from "antd";
import MenuSidebar from "./Menu";

const { Content } = Layout;

function MenuLayout({ children }) {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <MenuSidebar />
      <Content style={{ background: "#dedde2", overflow: "auto" }}>
        {children}
      </Content>
    </Layout>
  );
}

export default MenuLayout;
