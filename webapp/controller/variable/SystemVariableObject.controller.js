sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.variable.SystemVariableObject", {
        onInit: function () {
            this._oRouter = this.getOwnerComponent().getRouter();
            this._oModel = this.getOwnerComponent().getModel();

            this.getView().setModel(this._oModel, "sysVar");
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                mode: "create",
                title: "Create System Variable"
            }), "viewState");

            this._oRouter.getRoute("SystemVariableObject")
                .attachPatternMatched(this._onObjectMatched, this);

            this._oRouter.getRoute("SystemVariableCreate")
                .attachPatternMatched(this._onCreateMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            var sVarId = oEvent.getParameter("arguments").VarId;
            var vIsActiveEntity = oEvent.getParameter("arguments").IsActiveEntity;
            var bIsActiveEntity = String(vIsActiveEntity) === "true";

            this.getView().getModel("viewState").setData({
                mode: "edit",
                title: "Edit System Variable"
            });

            var sPath = this._oModel.createKey("/SystemVariables", {
                VarId: sVarId,
                IsActiveEntity: bIsActiveEntity
            });

            this.getView().bindElement({
                path: sPath,
                model: "sysVar"
            });
        },

        _onCreateMatched: function () {
            this.getView().getModel("viewState").setData({
                mode: "create",
                title: "Create System Variable"
            });

            var oContext = this._oModel.createEntry("/SystemVariables", {
                properties: {
                    VarName: "",
                    Description: "",
                    IsMandatory: false
                }
            });

            this.getView().setBindingContext(oContext, "sysVar");
        },

        onVarNameChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");

            if (!sValue || !sValue.trim()) {
                oEvent.getSource().setValueState("Error");
                oEvent.getSource().setValueStateText("Variable Name là bắt buộc");
            } else {
                oEvent.getSource().setValueState("None");
            }
        },

        onSavePress: function () {
            var oContext = this.getView().getBindingContext("sysVar");

            if (!oContext) {
                MessageBox.error("Không tìm thấy dữ liệu cần lưu");
                return;
            }

            var oData = oContext.getObject();

            if (!oData.VarName || !oData.VarName.trim()) {
                MessageBox.error("Variable Name là bắt buộc");
                return;
            }

            this._oModel.submitChanges({
                success: function () {
                    MessageToast.show("Đã lưu draft");
                    this._oModel.refresh(true);
                }.bind(this),
                error: function (oError) {
                    MessageBox.error("Lưu draft thất bại");
                    console.error(oError);
                }
            });
        },

        onActivatePress: function () {
            var oContext = this.getView().getBindingContext("sysVar");

            if (!oContext) {
                MessageBox.error("Không tìm thấy draft để activate");
                return;
            }

            var oData = oContext.getObject();

            if (!oData.VarName || !oData.VarName.trim()) {
                MessageBox.error("Variable Name là bắt buộc");
                return;
            }

            this._oModel.submitChanges({
                success: function () {
                    this._oModel.callFunction("/SystemVariablesActivate", {
                        method: "POST",
                        urlParameters: {
                            VarId: oData.VarId,
                            IsActiveEntity: false
                        },
                        success: function () {
                            MessageToast.show("Activate thành công");
                            this._oRouter.navTo("variablelist");
                        }.bind(this),
                        error: function (oError) {
                            MessageBox.error("Activate thất bại");
                            console.error(oError);
                        }
                    });
                }.bind(this),
                error: function (oError) {
                    MessageBox.error("Không thể lưu draft trước khi activate");
                    console.error(oError);
                }
            });
        },

        onCancelPress: function () {
            var oContext = this.getView().getBindingContext("sysVar");

            if (!oContext) {
                this._oRouter.navTo("variablelist");
                return;
            }

            var oData = oContext.getObject();

            if (oData.IsActiveEntity === false) {
                this._oModel.callFunction("/SystemVariablesDiscard", {
                    method: "POST",
                    urlParameters: {
                        VarId: oData.VarId,
                        IsActiveEntity: false
                    },
                    success: function () {
                        MessageToast.show("Đã hủy draft");
                        this._oModel.refresh(true);
                        this._oRouter.navTo("variablelist");
                    }.bind(this),
                    error: function (oError) {
                        var sMsg = "";
                        try {
                            sMsg = JSON.parse(oError.responseText).error.message.value || "";
                        } catch (e) {}

                        if (oError.statusCode === 404 || sMsg.indexOf("does not exist") > -1) {
                            this._oModel.refresh(true);
                            this._oRouter.navTo("variablelist");
                            return;
                        }

                        MessageBox.error("Hủy draft thất bại");
                        console.error(oError);
                    }.bind(this)
                });
            } else {
                this._oRouter.navTo("variablelist");
            }
        }
    });
});