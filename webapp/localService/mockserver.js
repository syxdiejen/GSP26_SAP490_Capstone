sap.ui.define([
	"sap/ui/core/util/MockServer"
], (MockServer) => {
	"use strict";

	return {
		init() {
			// create
			const oMockServer = new MockServer({
				rootUri: "/emailService/"
			});

			const oUrlParams = new URLSearchParams(window.location.search);

			// configure mock server with a delay
			MockServer.config({
				autoRespond: true,
				autoRespondAfter: oUrlParams.get("serverDelay") || 500
			});

			// simulate
			const sPath = sap.ui.require.toUrl("zemail/template/app/localService");
			oMockServer.simulate(sPath + "/metadata.xml", sPath + "/mockdata");

			// start
			oMockServer.start();
		}
	};
});
