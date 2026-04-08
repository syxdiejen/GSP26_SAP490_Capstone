sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.variable.SystemVariableList", {
        onInit: function () {
            this._oModel = this.getOwnerComponent().getModel();
            this._sSearchValue = "";
            this._sStatusKey = "ALL";
            this._bindTable();
        },

        _bindTable: function () {
            var oTable = this.byId("systemVariableTable");

            oTable.setModel(this._oModel, "sysVar");
            oTable.bindItems({
                path: "sysVar>/SystemVariables",
                parameters: {
                    countMode: "Inline"
                },
                template: oTable.getBindingInfo("items")?.template || oTable.getItems?.()[0]
            });
        },

        onSearch: function (oEvent) {
            this._sSearchValue = oEvent.getParameter("newValue") || "";
        },

        onStatusChange: function (oEvent) {
            this._sStatusKey = oEvent.getParameter("selectedItem").getKey();
        },

        onGoPress: function () {
            var oTable = this.byId("systemVariableTable");
            var oBinding = oTable.getBinding("items");
            var aFilters = [];

            if (this._sSearchValue) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("VarName", FilterOperator.Contains, this._sSearchValue),
                        new Filter("Description", FilterOperator.Contains, this._sSearchValue)
                    ],
                    and: false
                }));
            }

            switch (this._sStatusKey) {
                case "MANDATORY":
                    aFilters.push(new Filter("IsMandatory", FilterOperator.EQ, true));
                    break;
                case "OPTIONAL":
                    aFilters.push(new Filter("IsMandatory", FilterOperator.EQ, false));
                    break;
                case "DRAFT":
                    aFilters.push(new Filter("IsActiveEntity", FilterOperator.EQ, false));
                    break;
                default:
                    break;
            }

            oBinding.filter(aFilters);
        },

        onCreatePress: function () {
            this.getOwnerComponent().getRouter().navTo("SystemVariableCreate");
        },

        onItemPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("sysVar");
            this._openObjectForEdit(oContext);
        },

        onEditVariable: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("sysVar");
            this._openObjectForEdit(oContext);
        },

        _openObjectForEdit: function (oContext) {
            var oData = oContext.getObject();

            if (oData.IsActiveEntity === false) {
                this.getOwnerComponent().getRouter().navTo("SystemVariableObject", {
                    VarId: oData.VarId,
                    IsActiveEntity: false
                });
                return;
            }

            var sETag =
                oContext.getProperty && oContext.getProperty("__metadata/etag") ||
                oData.__metadata && oData.__metadata.etag ||
                "*";

            this._oModel.callFunction("/SystemVariablesEdit", {
                method: "POST",
                headers: {
                    "If-Match": sETag
                },
                urlParameters: {
                    VarId: oData.VarId,
                    IsActiveEntity: true,
                    PreserveChanges: true
                },
                success: function (oResult) {
                    this.getOwnerComponent().getRouter().navTo("SystemVariableObject", {
                        VarId: oResult.VarId,
                        IsActiveEntity: false
                    });
                }.bind(this),
                error: function (oError) {
                    MessageBox.error("Không thể mở draft để chỉnh sửa");
                    console.error(oError);
                }
            });
        },

        onDeleteVariable: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("sysVar");
            var oData = oContext.getObject();
            var sPath = oContext.getPath();

            MessageBox.confirm("Bạn có chắc muốn xóa biến này?", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    if (oData.IsActiveEntity === false) {
                        this._oModel.callFunction("/SystemVariablesDiscard", {
                            method: "POST",
                            urlParameters: {
                                VarId: oData.VarId,
                                IsActiveEntity: false
                            },
                            success: function () {
                                MessageToast.show("Đã hủy draft");
                                this.byId("systemVariableTable").getBinding("items").refresh();
                            }.bind(this),
                            error: function (oError) {
                                MessageBox.error("Hủy draft thất bại");
                                console.error(oError);
                            }
                        });
                        return;
                    }

                    this._oModel.remove(sPath, {
                        success: function () {
                            MessageToast.show("Đã xóa biến hệ thống");
                        },
                        error: function (oError) {
                            MessageBox.error("Xóa thất bại");
                            console.error(oError);
                        }
                    });
                }.bind(this)
            });
        }
    });
});