import React, { memo} from 'react';
import './index.scss';

import { globalSel } from "@ducks/global";
import { useSelector } from "react-redux";
import Breadcrumbs from "@wrappers/bluprint/breadcrumbs";
import Button from "@wrappers/bluprint/button";
import { Classes } from "@wrappers/bluprint/constants";
import NavbarDivider from "@wrappers/bluprint/navbar-divider";
import Navbar from "@wrappers/bluprint/navbar";
import NavbarGroup from "@wrappers/bluprint/navbar-group";
import NavbarHeading from "@wrappers/bluprint/navbar-heading";
import NavButton from "./NavButton";
import HomeButton from "./HomeButton";

interface IProps {
    externalRoutes: any;
}

const generateMenuItems = (pluginMenuData) => {
    const menuData = [
        // {
        //     title: 'Dashboard',
        //     key: 'dashboard',
        //     url: '/'
        // },
        // {
        //     title: 'User',
        //     key: 'user',
        //     children: [
        //         {
        //             title: 'Logout',
        //             key: 'logout',
        //             onClick: onLogout
        //         }
        //     ]
        // },
        // ...pluginMenuData,
    ];

    const generateItem = item => {
        const {
            key, title, url,
            icon, disabled,
            onClick = () => {
            }
        } = item;
        if (item.divider) {
            return <NavbarDivider key={Math.random()}/>
        }
        if (item.url) {
            return (
                <Button
                    className={Classes.MINIMAL}
                    key={key}
                    icon={icon}
                    text={title}
                    disabled={disabled}
                />
            )
        }
        return (
            <Button
                className={Classes.MINIMAL}
                key={key}
                icon={icon}
                text={title}
                disabled={disabled}
                onClick={onClick}
            />
        )
    };

    const generateSubmenu = items => items.map(menuItem => generateItem(menuItem));

    const generateMainMenu = menuItem => {
        if (menuItem.children) {
            return (
                <div className={'sub-menu'} key={menuItem.key}>
                    {menuItem.title}
                    {generateSubmenu(menuItem.children)}
                </div>
            )
        }
        return generateItem(menuItem)
    };

    return menuData.map(generateMainMenu);
};

const Header = memo<IProps>(({externalRoutes}) => {
    const breadcrumbs = useSelector(globalSel.breadcrumbsSelector);

    const isPresentableRoute = r => r.menuName;
    const addPluginRoutesInMenu = (route) => {
        const menuItem: any = {
            title: route.menuName,
            key: route.menuName.toLowerCase(),
        };
        if (route.path) {
            menuItem.url = route.path;
        }
        return menuItem
    };
    const pluginMenuData = externalRoutes
        .filter(isPresentableRoute)
        .map(addPluginRoutesInMenu);

    const menu = generateMenuItems(pluginMenuData);
    const isAuth = useSelector(globalSel.isAuthSelector);
    const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];

    return (
        !isAuth ? null :
            <div className="header">
                <Navbar>
                    <NavbarGroup>
                        <NavButton/>
                        <HomeButton/>
                        <div>
                            <Breadcrumbs paths={breadcrumbs}/>
                            {
                                lastBreadcrumb && <NavbarHeading style={{fontWeight: 'bold'}}>{lastBreadcrumb.text}</NavbarHeading>
                            }
                        </div>
                        {menu}
                    </NavbarGroup>
                </Navbar>
            </div>
    )
});

export default Header;
