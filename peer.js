var Peer = function(config)
{
	this.config =
	{
		dataname: 'peer',
		datatype: 'blob',
		reliable: true,
		ordered: true,
		iceservers: 'stun:stun.l.google.com:19302',
		onopen: function() {},
		onclose: function() {},
		onmessage: function() {},
		onerror: function() {},
		onlog: function() {}
	};

	for (var key in config)
	{
		this.config[key] = config[key];
	}

	this.connected = false;
	this.datachannel = null;
	this.offerpromise = null;
	this.answerpromise = null;
	this.localpromise = null;
	this.remotepromise = null;
	this.sdp_callback = null;

	try
	{
		this.connection =  new RTCPeerConnection
		({
			iceServers:
			[{
				urls: this.config.iceservers
			}]
		});

		this.connection.onicecandidate = Peer.bind(this, function(e)
		{
			if (e.candidate != null)
			{
				this.config.onlog('Peer: new ice candidate');
			} else
			{
				this.config.onlog('Peer: all ice candidates');

				this.onsdp(JSON.stringify(this.connection.localDescription));
			}
		});

		this.connection.onconnectionstatechange = Peer.bind(this, function(e)
		{
			this.config.onlog('Peer: connection state change');
		});

		this.connection.oniceconnectionstatechange = Peer.bind(this, function(e)
		{
			var state = e.target.iceConnectionState;

			this.config.onlog('Peer: ice connection state: ' + state);

			switch (state)
			{
				case 'connected':
				break;

				case 'disconnected':
				break;

				case 'checking':
				break;

				case 'failed':
				break;
			}
		});
	} catch (err)
	{
		this.config.onlog('Peer error: ' + err);
	}
}

Peer.prototype.onsdp = function(sdp)
{
	if (typeof this.sdp_callback == 'function')
	{
		this.sdp_callback(sdp);
	}
};

Peer.prototype.offer = function(sdp_callback)
{
	if (typeof sdp_callback == 'function')
	{
		this.sdp_callback = sdp_callback;
	}

	this.datachannel = this.connection.createDataChannel(this.config.dataname, { name: this.config.dataname, reliable : this.config.reliable, ordered : this.config.ordered });
	this.datachannel.binaryType = this.config.datatype;
	this.datachannel.onopen = Peer.bind(this, function() { this.config.onlog('Peer: connection established'); this.connected = true; this.config.onopen.apply(this, arguments); });
	this.datachannel.onclose = Peer.bind(this, function() { this.config.onlog('Peer: connection closed'); this.connected = false; this.config.onclose.apply(this, arguments); });
	this.datachannel.onerror = Peer.bind(this, this.config.onerror);
	this.datachannel.onmessage = Peer.bind(this, this.config.onmessage);

	this.offerpromise = this.connection.createOffer();
	this.offerpromise.then
	(
		Peer.bind(this, function(offer)
		{
			this.config.onlog('Peer: offer created');

			this.localpromise = this.connection.setLocalDescription(offer);
			this.localpromise.then
			(
				Peer.bind(this, function()
				{
					this.config.onlog('Peer: local description done');
				}),
				Peer.bind(this, function(reason)
				{
					this.config.onlog('Peer: local description failed (' + reason + ')');
					this.config.onlog(reason);
				})
			);
		}),
		Peer.bind(this, function(reason)
		{
			this.config.onlog('Peer: failed to create offer (' + reason + ')');
		})
	);
};

Peer.prototype.accept = function(answer)
{
	this.remotepromise = this.connection.setRemoteDescription(JSON.parse(answer));
	this.remotepromise.then
	(
		Peer.bind(this, function()
		{
			this.config.onlog('Peer: remote description done');
		}),
		Peer.bind(this, function(reason)
		{
			this.config.onlog('Peer: remote description failed (' + reason + ')');
		})
	);
};

Peer.prototype.answer = function(offer, sdp_callback)
{
	if (typeof sdp_callback == 'function')
	{
		this.sdp_callback = sdp_callback;
	}

	this.connection.ondatachannel = Peer.bind(this, function(e)
	{
		  this.datachannel = e.channel;
		  this.datachannel.onopen = Peer.bind(this, function() { this.config.onlog('Peer: connection established'); this.connected = true; this.config.onopen.apply(this, arguments); });
		  this.datachannel.onclose = Peer.bind(this, function() { this.config.onlog('Peer: connection closed'); this.connected = false; this.config.onclose.apply(this, arguments); });
		  this.datachannel.onerror = Peer.bind(this, this.config.onerror);
		  this.datachannel.onmessage = Peer.bind(this, this.config.onmessage);
	});

	this.remotepromise = this.connection.setRemoteDescription(JSON.parse(offer));
	this.remotepromise.then
	(
		Peer.bind(this, function()
		{
			this.config.onlog('Peer: remote description done');

			this.answerpromise = this.connection.createAnswer();
			this.answerpromise.then
			(
				Peer.bind(this, function(answer)
				{
					this.config.onlog('Peer: answer created');

					this.localpromise = this.connection.setLocalDescription(answer);
					this.localpromise.then
					(
						Peer.bind(this, function()
						{
							this.config.onlog('Peer: local description done');
						}),
						Peer.bind(this, function(reason)
						{
							this.config.onlog('Peer: local description failed (' + reason + ')');
						})
					);

				}),
				Peer.bind(this,  function(reason)
				{
					this.config.onlog('Peer: failed to create answer (' + reason + ')');
				})
			);
		}),
		Peer.bind(this, function(reason)
		{
			this.config.onlog('Peer: remote description failed (' + reason + ')');
		})
	);
};

Peer.prototype.close = function()
{
	if (this.connected)
	{
		this.config.onlog('Peer: closing connection');

		this.connected = true;
		this.connection.close();

		this.datachannel.onopen = null;
		this.datachannel.onclose = null;
		this.datachannel.onerror = null;
		this.datachannel.onmessage = null;
	}
};

Peer.prototype.send = function(message)
{
	if (this.connected)
	{
		this.datachannel.send(message);
	}
};

Peer.bind = function(context, callback)
{
	return function() { return callback.apply(context, arguments) };
};
